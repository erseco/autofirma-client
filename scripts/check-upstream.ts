import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Extensión .ts literal: Node ejecuta este script con borrado nativo de tipos y
// no remapea .js a .ts. Las pruebas importan .js porque Vitest sí lo resuelve.
import {
  parseAutoscriptConstants,
  selectLatestTag,
  sha256Hex,
} from "./upstream.ts";
import { readLock, type UpstreamLock } from "./vendor-autoscript.ts";

/**
 * Construye el pin nuevo leyendo las constantes del fichero descargado.
 */
export function buildUpdatedLock(
  current: UpstreamLock,
  tag: string,
  commit: string,
  source: string,
): UpstreamLock {
  return {
    repo: current.repo,
    tag,
    commit,
    path: current.path,
    sha256: sha256Hex(new TextEncoder().encode(source)),
    autoscript: parseAutoscriptConstants(source),
  };
}

/**
 * Resumen legible para el cuerpo del pull request.
 */
export function describeChange(
  previous: UpstreamLock,
  next: UpstreamLock,
): string {
  return [
    `Tag: ${previous.tag} → ${next.tag}`,
    `AutoScript VERSION: ${previous.autoscript.version} → ${next.autoscript.version}`,
    `VERSION_CODE: ${previous.autoscript.versionCode} → ${next.autoscript.versionCode}`,
    `PROTOCOL_VERSION: ${previous.autoscript.protocolVersion} → ${next.autoscript.protocolVersion}`,
    `sha256: ${next.sha256}`,
    `Commit: ${next.commit}`,
  ].join("\n");
}

async function main(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const lockPath = join(root, "autoscript.lock.json");
  const current = await readLock(lockPath);

  const tagsResponse = await fetch(
    `https://api.github.com/repos/${current.repo}/tags?per_page=100`,
  );
  if (!tagsResponse.ok) {
    throw new Error(
      `No se pudieron listar los tags: HTTP ${tagsResponse.status}`,
    );
  }

  const tags = (await tagsResponse.json()) as {
    name: string;
    commit: { sha: string };
  }[];
  const latest = selectLatestTag(tags.map((entry) => entry.name));
  const commit = tags.find((entry) => entry.name === latest)?.commit.sha;
  if (!commit) {
    throw new Error(`No se encontró el commit del tag ${latest}`);
  }

  const fileResponse = await fetch(
    `https://raw.githubusercontent.com/${current.repo}/${commit}/${current.path}`,
  );
  if (!fileResponse.ok) {
    throw new Error(
      `No se pudo descargar el fichero: HTTP ${fileResponse.status}`,
    );
  }

  const source = await fileResponse.text();
  const next = buildUpdatedLock(current, latest, commit, source);

  if (next.sha256 === current.sha256 && next.tag === current.tag) {
    console.log("Sin cambios respecto al pin actual.");
    return;
  }

  await writeFile(lockPath, `${JSON.stringify(next, null, 2)}\n`);
  await writeFile(
    join(root, "upstream-change.txt"),
    `${describeChange(current, next)}\n`,
  );
  console.log(describeChange(current, next));
}

if (process.argv[1]?.endsWith("check-upstream.ts")) {
  await main();
}
