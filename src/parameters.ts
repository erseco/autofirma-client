import type { ExtraParameters } from "./types.js";

/**
 * Serializa parámetros como líneas `clave=valor`, que es el formato exigido
 * por AutoScript. Las claves con separadores se rechazan para evitar resultados
 * ambiguos.
 */
export function serializeParameters(parameters: ExtraParameters = {}): string {
  return Object.entries(parameters)
    .filter((entry): entry is [string, string | number | boolean] => {
      return entry[1] !== undefined && entry[1] !== null;
    })
    .map(([key, value]) => {
      if (/[\r\n=]/u.test(key)) {
        throw new TypeError(`Nombre de parámetro no válido: ${key}`);
      }

      const serializedValue = String(value).replace(/[\r\n]+/gu, " ");
      return `${key}=${serializedValue}`;
    })
    .join("\n");
}
