import { AutoScriptUnavailableError, fromNativeError } from "./errors.js";
import type { AutoScriptApi, SignatureOperation, SignResult } from "./types.js";

declare global {
  interface Window {
    AutoScript?: AutoScriptApi;
  }
}

/**
 * Resuelve la API inyectada o el objeto global oficial.
 */
export function resolveAutoScript(injected?: AutoScriptApi): AutoScriptApi {
  if (injected) {
    return injected;
  }

  if (typeof window !== "undefined" && window.AutoScript) {
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
