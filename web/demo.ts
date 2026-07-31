import { AutoFirmaClient, loadAutoScript } from "../src/index.js";
import type { SignatureFormat } from "../src/index.js";
import { readCertificate } from "./certificate.js";

const file = document.querySelector<HTMLInputElement>("#file");
const format = document.querySelector<HTMLSelectElement>("#format");
const signButton = document.querySelector<HTMLButtonElement>("#sign");
const result = document.querySelector<HTMLParagraphElement>("#result");
const certificate = document.querySelector<HTMLDListElement>("#certificate");
const download = document.querySelector<HTMLAnchorElement>("#download");

if (file && format && signButton && result && certificate && download) {
  const autoScript = await loadAutoScript("autoscript.js");
  const client = new AutoFirmaClient({ autoScript });
  client.initialize();

  // No hay forma fiable de comprobar de antemano si AutoFirma está
  // instalada: la operación que lo indicaba en AutoScript está deprecada y
  // siempre devuelve `true`. Se intenta firmar directamente y, si AutoFirma
  // no responde, se muestra el error que devuelva `sign()`.
  signButton.addEventListener("click", async () => {
    const selected = file.files?.[0];
    if (!selected) {
      result.textContent = "Elige un fichero primero.";
      return;
    }

    result.textContent = "Firmando…";
    certificate.replaceChildren();
    download.hidden = true;

    try {
      const signature = await client.sign({
        data: selected,
        format: format.value as SignatureFormat,
      });

      result.textContent = `Firma generada: ${signature.signature.length} caracteres en base64.`;

      if (signature.certificate) {
        const summary = readCertificate(signature.certificate);
        // Anotado como tupla: sin esto, TypeScript infiere `string[]` para
        // cada fila y, con `noUncheckedIndexedAccess`, desestructurarla da
        // `string | undefined`, que no encaja con `textContent`.
        const fields: ReadonlyArray<readonly [string, string]> = [
          ["Titular", summary.subject],
          ["Emisora", summary.issuer],
          ["Número de serie", summary.serialNumber],
          ["Válido desde", summary.notBefore.toLocaleDateString("es-ES")],
          ["Válido hasta", summary.notAfter.toLocaleDateString("es-ES")],
        ];
        for (const [label, value] of fields) {
          const term = document.createElement("dt");
          term.textContent = label;
          const definition = document.createElement("dd");
          definition.textContent = value;
          certificate.append(term, definition);
        }
      }

      download.href = `data:application/octet-stream;base64,${signature.signature}`;
      download.download = `${selected.name}.firma`;
      download.hidden = false;
    } catch (error) {
      result.textContent =
        error instanceof Error ? error.message : "No se pudo firmar.";
    }
  });
}
