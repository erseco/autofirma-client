import { AutoFirmaError } from "./errors.js";
import type { AutoScriptApi } from "./types.js";

/**
 * Opciones del cargador. `document` existe para poder probarlo sin navegador.
 */
export interface LoadOptions {
  readonly document?: Document;
}

/**
 * Inserta `autoscript.js` como script clásico y resuelve con el objeto global.
 *
 * AutoScript no es un módulo: no declara UMD, no exporta nada y confía en que
 * su `var` de nivel superior se convierta en global. Importarlo con un
 * empaquetador lo deja en ámbito de módulo y el global nunca aparece, así que
 * la única forma correcta de cargarlo es una etiqueta `script`.
 */
export function loadAutoScript(
  url: string,
  options: LoadOptions = {},
): Promise<AutoScriptApi> {
  const existing = globalThis.window?.AutoScript;
  if (existing) {
    return Promise.resolve(existing);
  }

  const target = options.document ?? globalThis.document;
  if (!target) {
    return Promise.reject(
      new AutoFirmaError(
        "No hay documento donde insertar AutoScript.",
        "AUTOSCRIPT_UNAVAILABLE",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const script = target.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      const loaded = globalThis.window?.AutoScript;
      if (loaded) {
        resolve(loaded);
        return;
      }
      reject(
        new AutoFirmaError(
          `${url} se cargó pero no definió el objeto global AutoScript.`,
          "AUTOSCRIPT_UNAVAILABLE",
        ),
      );
    };
    script.onerror = () => {
      reject(
        new AutoFirmaError(
          `No se pudo cargar ${url}.`,
          "AUTOSCRIPT_UNAVAILABLE",
        ),
      );
    };
    target.head.appendChild(script);
  });
}
