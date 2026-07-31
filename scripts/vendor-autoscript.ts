import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Extensión .ts literal: Node ejecuta este script con borrado nativo de tipos y
// no remapea .js a .ts. Las pruebas importan .js porque Vitest sí lo resuelve.
import { parseAutoscriptConstants, sha256Hex } from "./upstream.ts";

export interface UpstreamLock {
  readonly repo: string;
  readonly tag: string;
  readonly commit: string;
  readonly path: string;
  readonly sha256: string;
  readonly autoscript: {
    readonly version: string;
    readonly versionCode: number;
    readonly protocolVersion: number;
  };
}

/**
 * URL inmutable: se fija por commit, no por rama ni por tag, que pueden moverse.
 */
export function rawUrlFor(lock: UpstreamLock): string {
  return `https://raw.githubusercontent.com/${lock.repo}/${lock.commit}/${lock.path}`;
}

/**
 * Lee el pin versionado.
 */
export async function readLock(path: string): Promise<UpstreamLock> {
  return JSON.parse(await readFile(path, "utf8")) as UpstreamLock;
}

/**
 * Deja en `destination` el AutoScript fijado. No usa la red si la copia local
 * ya coincide con la huella del pin. Aborta si lo descargado no coincide.
 */
export async function verifyOrDownload(
  lock: UpstreamLock,
  destination: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"cached" | "downloaded"> {
  const cached = await readFile(destination).catch(() => undefined);
  if (cached && sha256Hex(cached) === lock.sha256) {
    return "cached";
  }

  const response = await fetchImpl(rawUrlFor(lock));
  if (!response.ok) {
    throw new Error(
      `No se pudo descargar AutoScript: HTTP ${response.status} en ${rawUrlFor(lock)}`,
    );
  }

  const downloaded = new Uint8Array(await response.arrayBuffer());
  const digest = sha256Hex(downloaded);
  if (digest !== lock.sha256) {
    throw new Error(
      `El sha256 no coincide con el pin: esperado ${lock.sha256}, obtenido ${digest}`,
    );
  }

  const source = new TextDecoder().decode(downloaded);
  const constants = parseAutoscriptConstants(source);
  if (constants.version !== lock.autoscript.version) {
    throw new Error(
      `El fichero declara VERSION ${constants.version} y el pin dice ${lock.autoscript.version}`,
    );
  }

  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, downloaded);
  return "downloaded";
}

/**
 * Punto de entrada del script. Se invoca desde `prepack` y desde `npm run vendor`.
 */
async function main(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const lock = await readLock(join(root, "autoscript.lock.json"));
  const destination = join(root, "vendor", "autoscript.js");
  const outcome = await verifyOrDownload(lock, destination);
  console.log(
    `AutoScript ${lock.autoscript.version} (${lock.tag}) ${outcome === "cached" ? "ya estaba en" : "descargado en"} vendor/autoscript.js`,
  );
}

if (process.argv[1]?.endsWith("vendor-autoscript.ts")) {
  await main();
}
