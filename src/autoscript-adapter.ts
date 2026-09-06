import {
  AutoFirmaError,
  AutoScriptUnavailableError,
  fromNativeError,
} from "./errors.js";
import type {
  BatchDocumentResult,
  AutoScriptApi,
  SignatureOperation,
  SignResult,
} from "./types.js";

declare global {
  interface Window {
    AutoScript?: AutoScriptApi;
  }
}

/**
 * Comprueba que un candidato sea la API de AutoScript y no cualquier otra cosa
 * que ocupe el mismo nombre global.
 *
 * `window.AutoScript` no requiere ejecutar JavaScript para existir: un elemento
 * con `id="AutoScript"` o `name="AutoScript"` lo define solo (DOM clobbering),
 * y los saneadores de HTML habituales permiten `id`. Comprobar únicamente que
 * el global sea *truthy* aceptaba ese elemento como si fuera la API: la firma
 * no fallaba al construir el cliente sino mucho después, con un `TypeError`
 * sin `code` al invocar una operación inexistente.
 *
 * `sign` es la única operación que AutoScript garantiza en todas sus versiones
 * —el resto son opcionales en `AutoScriptApi`—, así que es lo mínimo que puede
 * exigirse sin rechazar versiones legítimas.
 */
export function isAutoScriptApi(
  candidate: unknown,
): candidate is AutoScriptApi {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as AutoScriptApi).sign === "function"
  );
}

/**
 * Indica si el objeto global oficial de AutoScript está disponible y tiene la
 * superficie mínima esperada.
 */
export function isAutoScriptAvailable(): boolean {
  return typeof window !== "undefined" && isAutoScriptApi(window.AutoScript);
}

/**
 * Resuelve la API inyectada o el objeto global oficial.
 */
export function resolveAutoScript(injected?: AutoScriptApi): AutoScriptApi {
  if (injected) {
    return injected;
  }

  if (typeof window !== "undefined" && isAutoScriptApi(window.AutoScript)) {
    return window.AutoScript;
  }

  throw new AutoScriptUnavailableError();
}

/**
 * Adapta una operación nativa basada en callbacks a una promesa.
 */
export function invokeSignatureOperation(
  operation: SignatureOperation,
  data: string,
  algorithm: string,
  format: string,
  parameters: string,
): Promise<SignResult> {
  return new Promise((resolve, reject) => {
    operation(
      data,
      algorithm,
      format,
      parameters,
      (signature, certificate, extraData) => {
        resolve({
          signature,
          ...(certificate ? { certificate } : {}),
          ...(extraData ? { extraData } : {}),
        });
      },
      (errorType, errorMessage) => {
        reject(fromNativeError(errorType, errorMessage));
      },
    );
  });
}

/** Comprueba el contrato de JSONBatchManager y la correspondencia con el lote. */
export function readBatchResults(
  data: unknown,
  ids: ReadonlySet<string>,
): readonly BatchDocumentResult[] {
  const signs = (data as { signs?: unknown } | null)?.signs;
  const remaining = new Set(ids);
  if (!Array.isArray(signs) || signs.length !== ids.size) {
    throw new AutoFirmaError(
      "Invalid batch response",
      "INVALID_BATCH_RESPONSE",
    );
  }
  for (const item of signs) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !remaining.delete(item.id) ||
      typeof item.result !== "string" ||
      (item.description !== undefined &&
        typeof item.description !== "string") ||
      (item.signature !== undefined && typeof item.signature !== "string") ||
      (item.result === "DONE_AND_SAVED" && !item.signature)
    ) {
      throw new AutoFirmaError(
        "Invalid batch document result",
        "INVALID_BATCH_RESPONSE",
      );
    }
  }
  return signs;
}
