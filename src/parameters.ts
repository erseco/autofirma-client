import type { ExtraParameters } from "./types.js";

/**
 * Serializa parámetros como líneas `clave=valor`, que es el formato exigido
 * por AutoScript. Las claves con separadores se rechazan para evitar resultados
 * ambiguos.
 *
 * **Los valores se modifican en silencio.** Un valor con saltos de línea se
 * aplana a una sola línea sustituyéndolos por espacios, y quien llama no recibe
 * ningún aviso: `layer2Text: "línea 1\nlínea 2"` se envía como
 * `layer2Text=línea 1 línea 2`.
 *
 * No es cosmético, es la barrera que impide inyectar parámetros. AutoScript
 * trocea esta cadena con `split(params, "\n")` (ver `addSignatoryCertificateToExtraParams`
 * en el `vendor/autoscript.js` fijado), así que un valor que conserve un salto
 * de línea añade una línea más y, con ella, un parámetro que quien integra
 * nunca puso. Importa cuando el valor viene de la persona usuaria y no del
 * código: el texto de la firma visible (`layer2Text`) es justo ese caso.
 *
 * De las claves se rechazan `\r`, `\n` y `=`, que son los separadores que
 * AutoScript reconoce. No se rechazan los dos puntos ni los espacios: si el
 * lado Java de AutoFirma carga estos parámetros con `java.util.Properties`
 * también los trataría como separador, pero eso no se puede comprobar contra el
 * fichero fijado —ahí solo está el JavaScript— y no se impone una regla por una
 * suposición sobre un parser que no se ha leído. El riesgo real es mínimo: las
 * claves son literales del código de quien integra, no entrada externa.
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
