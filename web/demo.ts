import { AutoFirmaClient, loadAutoScript } from "../src/index.js";
import type { SignatureFormat } from "../src/index.js";
import { readCertificate } from "./certificate.js";

/** Extensión de fichero que corresponde al resultado de cada formato de firma. */
const EXTENSION_BY_FORMAT: Record<SignatureFormat, string> = {
  PAdES: "pdf",
  CAdES: "csig",
  XAdES: "xsig",
  FacturaE: "xsig",
};

const file = document.querySelector<HTMLInputElement>("#file");
const format = document.querySelector<HTMLSelectElement>("#format");
const signButton = document.querySelector<HTMLButtonElement>("#sign");
const result = document.querySelector<HTMLParagraphElement>("#result");
const certificate = document.querySelector<HTMLDListElement>("#certificate");
const download = document.querySelector<HTMLAnchorElement>("#download");

void main();

/**
 * Arranca la demo. Aislado en una función (en vez de nivel de módulo) para
 * poder usar `try`/`catch`/`return` normales: un `await` de nivel de módulo
 * que rechaza produce un rechazo sin gestionar y deja la página inerte y sin
 * ningún mensaje para quien la visita.
 */
async function main(): Promise<void> {
  if (!file || !format || !signButton || !result || !certificate || !download) {
    console.error(
      "Faltan elementos del DOM que la demo necesita: #file, #format, #sign, #result, #certificate o #download.",
    );
    return;
  }

  let autoScript;
  try {
    autoScript = await loadAutoScript("autoscript.js");
  } catch (error) {
    result.textContent =
      error instanceof Error
        ? `No se pudo cargar AutoScript: ${error.message}`
        : "No se pudo cargar AutoScript.";
    return;
  }

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

    signButton.disabled = true;
    result.textContent = "Firmando…";
    certificate.replaceChildren();
    download.hidden = true;

    try {
      const selectedFormat = format.value as SignatureFormat;
      const signature = await client.sign({
        data: selected,
        format: selectedFormat,
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

      const extension = EXTENSION_BY_FORMAT[selectedFormat];
      download.href = `data:application/octet-stream;base64,${signature.signature}`;
      download.download = `${selected.name}.${extension}`;
      download.hidden = false;
    } catch (error) {
      result.textContent =
        error instanceof Error ? error.message : "No se pudo firmar.";
    } finally {
      signButton.disabled = false;
    }
  });
}
