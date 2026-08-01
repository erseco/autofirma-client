import { isAutoScriptApi } from "./autoscript-adapter.js";
import { AutoFirmaError } from "./errors.js";
import type { AutoScriptApi } from "./types.js";

/**
 * Opciones del cargador. `document` existe para poder probarlo sin navegador.
 *
 * `integrity` y `crossOrigin` son los atributos de Subresource Integrity: el
 * navegador descarta el fichero si su huella no coincide. El paquete fija
 * `autoscript.js` por sha256 (ver ADR-0005) y esa garantía se pierde en cuanto
 * el fichero se sirve desde un origen que no se controla, así que esta es la
 * forma de recuperarla. Servirlo del propio origen, como recomienda el README,
 * sigue siendo la opción preferible y ahí SRI aporta poco.
 *
 * `autoscript.lock.json` guarda la huella en hexadecimal y SRI la quiere en
 * base64 con prefijo `sha256-`. La conversión:
 *
 * ```sh
 * printf 'sha256-%s\n' "$(node -p "require('./autoscript.lock.json').sha256" \
 *   | xxd -r -p | base64)"
 * ```
 */
export interface LoadOptions {
  readonly document?: Document;
  readonly integrity?: string;
  readonly crossOrigin?: "anonymous" | "use-credentials";
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
  if (isAutoScriptApi(existing)) {
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
    if (options.integrity) {
      script.integrity = options.integrity;
    }
    if (options.crossOrigin) {
      script.crossOrigin = options.crossOrigin;
    }
    script.onload = () => {
      const loaded = globalThis.window?.AutoScript;
      if (isAutoScriptApi(loaded)) {
        resolve(loaded);
        return;
      }
      reject(
        new AutoFirmaError(
          `${url} se cargó pero window.AutoScript no es la API de AutoScript.`,
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
