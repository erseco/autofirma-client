import type { SignableData } from "./types.js";

/**
 * Convierte datos binarios o texto Base64 en el formato esperado por
 * AutoScript. Las cadenas se consideran ya codificadas en Base64.
 */
export async function toBase64(data: SignableData): Promise<string> {
  if (typeof data === "string") {
    return data;
  }

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return bytesToBase64(new Uint8Array(await data.arrayBuffer()));
  }

  if (data instanceof ArrayBuffer) {
    return bytesToBase64(new Uint8Array(data));
  }

  if (data instanceof Uint8Array) {
    return bytesToBase64(data);
  }

  throw new TypeError("Tipo de dato no compatible.");
}

/**
 * Decodifica una cadena Base64 estándar a bytes sin depender de Node.js.
 */
export function fromBase64(data: string): Uint8Array {
  if (typeof atob !== "function") {
    throw new Error("El entorno no proporciona una función Base64 compatible.");
  }

  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

/**
 * Codifica bytes sin depender de Node.js, para conservar compatibilidad con
 * navegadores.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  throw new Error("El entorno no proporciona una función Base64 compatible.");
}
