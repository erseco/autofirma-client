import { createHash } from "node:crypto";

/** Solo cuentan los tags de versión publicada: `v1.9` o `v1.9.2`. */
const RELEASE_TAG = /^v(\d+)\.(\d+)(?:\.(\d+))?$/;

/**
 * Devuelve el tag mayor por orden numérico. Descarta el legado (`OT_*`,
 * `Version_*`) y las candidatas (`v1.9_RC`), que un orden textual colocaría
 * por delante del release definitivo.
 */
export function selectLatestTag(tagNames: string[]): string {
  const ordered = tagNames
    .map((tag) => ({ tag, parts: RELEASE_TAG.exec(tag) }))
    .filter(
      (entry): entry is { tag: string; parts: RegExpExecArray } =>
        entry.parts !== null,
    )
    .map(({ tag, parts }) => ({
      tag,
      key: [Number(parts[1]), Number(parts[2]), Number(parts[3] ?? 0)] as const,
    }))
    .sort((a, b) => {
      for (let index = 0; index < 3; index += 1) {
        const difference = (a.key[index] ?? 0) - (b.key[index] ?? 0);
        if (difference !== 0) {
          return difference;
        }
      }
      return 0;
    });

  const latest = ordered.at(-1);
  if (!latest) {
    throw new Error("No se encontró ningún tag de versión publicada.");
  }

  return latest.tag;
}

/**
 * Convierte `v1.9` en `1.9.0` para poder usarlo como versión de npm.
 */
export function normalizeTagVersion(tag: string): string {
  const parts = RELEASE_TAG.exec(tag);
  if (!parts) {
    throw new Error(`El tag ${tag} no es una versión publicada.`);
  }

  return `${parts[1]}.${parts[2]}.${parts[3] ?? 0}`;
}

export interface AutoscriptConstants {
  readonly version: string;
  readonly versionCode: number;
  readonly protocolVersion: number;
}

/**
 * Lee las tres constantes que AutoScript declara en su propio código. Es la
 * única forma fiable de saber qué versión trae un fichero concreto.
 */
export function parseAutoscriptConstants(source: string): AutoscriptConstants {
  const version = /var\s+VERSION\s*=\s*"([^"]+)"/.exec(source);
  const versionCode = /var\s+VERSION_CODE\s*=\s*(\d+)/.exec(source);
  const protocolVersion = /var\s+PROTOCOL_VERSION\s*=\s*(\d+)/.exec(source);

  if (!version) {
    throw new Error("No se encontró la constante VERSION.");
  }
  if (!versionCode) {
    throw new Error("No se encontró la constante VERSION_CODE.");
  }
  if (!protocolVersion) {
    throw new Error("No se encontró la constante PROTOCOL_VERSION.");
  }

  return {
    version: version[1] as string,
    versionCode: Number(versionCode[1]),
    protocolVersion: Number(protocolVersion[1]),
  };
}

/**
 * Huella del contenido descargado, en minúsculas.
 */
export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}
