import {
  AutoFirmaClient,
  AutoFirmaError,
  loadAutoScript,
  toBase64,
} from "../src/index.js";
import type { ExtraParameters, SignatureFormat } from "../src/index.js";
import { readCertificate } from "./certificate.js";

/**
 * Describe un fallo conservando el detalle que devolvió AutoFirma.
 *
 * El mensaje normalizado del cliente dice que la operación no se completó,
 * pero no por qué. AutoScript sí lo dice —con códigos como `SAF_xx` o el tipo
 * de excepción nativa— y esa es justo la información que distingue un
 * certificado que no sirve para firmar de un fallo de comunicación.
 */
function describeError(error: unknown): string {
  if (error instanceof AutoFirmaError) {
    const detail = [error.nativeType, error.nativeMessage]
      .filter((value): value is string => Boolean(value))
      .join(": ");
    return detail ? `${error.message} (${detail})` : error.message;
  }

  return error instanceof Error ? error.message : "No se pudo firmar.";
}

/** Extensión de fichero que corresponde al resultado de cada formato de firma. */
const EXTENSION_BY_FORMAT: Record<SignatureFormat, string> = {
  PAdES: "pdf",
  CAdES: "csig",
  XAdES: "xsig",
  FacturaE: "xsig",
};

/**
 * Nombre del fichero firmado que se ofrece descargar.
 *
 * PAdES devuelve el mismo documento con la firma incrustada, así que conserva
 * la extensión del original: un PDF firmado sigue siendo un PDF. CAdES y XAdES
 * no devuelven el documento sino un contenedor de firma con formato propio, y
 * heredar ahí la extensión original haría creer que el fichero descargado es
 * el documento cuando no lo es.
 */
function signedFileName(originalName: string, format: SignatureFormat): string {
  const separator = originalName.lastIndexOf(".");
  const base = separator > 0 ? originalName.slice(0, separator) : originalName;
  const originalExtension =
    separator > 0 ? originalName.slice(separator + 1) : "";
  const extension =
    format === "PAdES" && originalExtension
      ? originalExtension
      : EXTENSION_BY_FORMAT[format];

  return `${base}_signed.${extension}`;
}

/**
 * Plantilla por defecto del texto de la firma visible. Las claves `$$…$$` las
 * sustituye AutoFirma con datos del certificado y de la firma; el ejemplo de
 * su propia documentación es «Firmado por $$SUBJECTCN$$ el día
 * $$SIGNDATE=dd/MM/yyyy$$.».
 */
/**
 * El mismo texto que AutoFirma trae por omisión, tomado de `pdfLayer2Text` en
 * el `preferences.properties` del repositorio oficial: así el sello sale igual
 * que firmando con la aplicación de escritorio.
 */
const DEFAULT_LAYER2_TEXT =
  "Firmado por $$SUBJECTCN$$ el día $$SIGNDATE=dd/MM/yyyy$$ con un certificado emitido por $$ISSUERCN$$";

/**
 * Recuadro de la firma visible, en puntos PDF contados desde la esquina
 * inferior izquierda. Estos valores sitúan la firma abajo a la izquierda de una
 * página A4 (595 × 842 puntos).
 */
const SIGNATURE_BOX = { lowerX: 50, lowerY: 50, upperX: 300, upperY: 130 };

/** Recuadro de la imagen estampada, centrado en una página A4. */
const STAMP_BOX = { lowerX: 170, lowerY: 350, upperX: 425, upperY: 500 };

/**
 * Convierte una imagen a Base64 comprobando antes que sea JPEG.
 *
 * AutoFirma rechaza cualquier otro formato, y hacerlo aquí evita que el fallo
 * aparezca como un error opaco de la aplicación nativa.
 */
async function toJpegBase64(image: File): Promise<string> {
  if (image.type !== "image/jpeg") {
    throw new AutoFirmaError(
      `AutoFirma solo admite imágenes JPEG y «${image.name}» es ${image.type || "de tipo desconocido"}.`,
      "UNSUPPORTED_IMAGE",
    );
  }

  return toBase64(image);
}

const file = document.querySelector<HTMLInputElement>("#file");
const format = document.querySelector<HTMLSelectElement>("#format");
const signButton = document.querySelector<HTMLButtonElement>("#sign");
const result = document.querySelector<HTMLParagraphElement>("#result");
const certificate = document.querySelector<HTMLDListElement>("#certificate");
const download = document.querySelector<HTMLAnchorElement>("#download");
const padesOptions =
  document.querySelector<HTMLFieldSetElement>("#pades-options");
const visible = document.querySelector<HTMLSelectElement>("#visible");
const visibleTextRow =
  document.querySelector<HTMLDivElement>("#visible-text-row");
const layer2 = document.querySelector<HTMLInputElement>("#layer2");
const visibleImageRow =
  document.querySelector<HTMLDivElement>("#visible-image-row");
const rubric = document.querySelector<HTMLInputElement>("#rubric");
const stamp = document.querySelector<HTMLInputElement>("#stamp");
const stampImageRow =
  document.querySelector<HTMLDivElement>("#stamp-image-row");
const stampImage = document.querySelector<HTMLInputElement>("#stamp-image");
const mobileNotice =
  document.querySelector<HTMLParagraphElement>("#mobile-notice");

/**
 * Indica si el navegador es de un móvil, donde esta demo no puede firmar.
 *
 * En Android e iOS, AutoScript no se comunica con la aplicación por un socket
 * local sino a través de un servidor intermedio, y busca sus dos servicios en
 * el origen de la página. Una página estática no puede ofrecerlos, así que el
 * intento termina en un diálogo de AutoScript que además llega sin texto.
 * Avisar antes evita ese callejón sin salida.
 */
function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

void main();

/**
 * Arranca la demo. Aislado en una función (en vez de nivel de módulo) para
 * poder usar `try`/`catch`/`return` normales: un `await` de nivel de módulo
 * que rechaza produce un rechazo sin gestionar y deja la página inerte y sin
 * ningún mensaje para quien la visita.
 */
async function main(): Promise<void> {
  if (
    !file ||
    !format ||
    !signButton ||
    !result ||
    !certificate ||
    !download ||
    !padesOptions ||
    !visible ||
    !visibleTextRow ||
    !layer2 ||
    !visibleImageRow ||
    !rubric ||
    !stamp ||
    !stampImageRow ||
    !stampImage ||
    !mobileNotice
  ) {
    console.error(
      "Faltan elementos del DOM que la demo necesita: #file, #format, #sign, #result, #certificate, #download, #pades-options, #visible, #visible-text-row, #layer2, #visible-image-row, #rubric, #stamp, #stamp-image-row o #stamp-image.",
    );
    return;
  }

  if (isMobile()) {
    mobileNotice.hidden = false;
    signButton.disabled = true;
    return;
  }

  layer2.value = DEFAULT_LAYER2_TEXT;

  /** Muestra solo los controles que aplican al formato y a la opción elegidos. */
  const syncOptions = (): void => {
    padesOptions.hidden = format.value !== "PAdES";
    visibleTextRow.hidden = visible.value !== "text";
    visibleImageRow.hidden = visible.value !== "image";
    stampImageRow.hidden = !stamp.checked;
  };

  format.addEventListener("change", syncOptions);
  visible.addEventListener("change", syncOptions);
  stamp.addEventListener("change", syncOptions);
  syncOptions();

  /**
   * Construye los `extraParams` de la firma visible.
   *
   * `layer2Text` y `signatureRubricImage` se excluyen entre sí: AutoFirma
   * ignora el texto si se le ha dado una imagen de rúbrica, así que la interfaz
   * ofrece uno u otro y nunca ambos.
   */
  const buildParameters = async (): Promise<ExtraParameters> => {
    if (format.value !== "PAdES") {
      return {};
    }

    const parameters: Record<string, string | number> = {};

    if (visible.value !== "none") {
      parameters["signaturePage"] = 1;
      parameters["signaturePositionOnPageLowerLeftX"] = SIGNATURE_BOX.lowerX;
      parameters["signaturePositionOnPageLowerLeftY"] = SIGNATURE_BOX.lowerY;
      parameters["signaturePositionOnPageUpperRightX"] = SIGNATURE_BOX.upperX;
      parameters["signaturePositionOnPageUpperRightY"] = SIGNATURE_BOX.upperY;
    }

    if (visible.value === "text") {
      // Solo se manda el texto: la tipografía, el tamaño y el color se dejan a
      // AutoFirma, que aplica los suyos. Fijar uno aquí haría que el sello
      // saliera distinto al de la aplicación de escritorio sin motivo.
      parameters["layer2Text"] = layer2.value || DEFAULT_LAYER2_TEXT;
    }

    if (visible.value === "image") {
      const chosen = rubric.files?.[0];
      if (!chosen) {
        throw new AutoFirmaError(
          "Elige la imagen JPEG de la rúbrica.",
          "MISSING_IMAGE",
        );
      }
      parameters["signatureRubricImage"] = await toJpegBase64(chosen);
    }

    if (stamp.checked) {
      const chosen = stampImage.files?.[0];
      if (!chosen) {
        throw new AutoFirmaError(
          "Elige la imagen JPEG que quieres estampar.",
          "MISSING_IMAGE",
        );
      }
      parameters["image"] = await toJpegBase64(chosen);
      // 0 estampa la imagen en todas las páginas; -1 solo en la última.
      parameters["imagePage"] = 0;
      parameters["imagePositionOnPageLowerLeftX"] = STAMP_BOX.lowerX;
      parameters["imagePositionOnPageLowerLeftY"] = STAMP_BOX.lowerY;
      parameters["imagePositionOnPageUpperRightX"] = STAMP_BOX.upperX;
      parameters["imagePositionOnPageUpperRightY"] = STAMP_BOX.upperY;
    }

    return parameters;
  };

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
        parameters: await buildParameters(),
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
      download.download = signedFileName(selected.name, selectedFormat);
      download.hidden = false;
    } catch (error) {
      result.textContent = describeError(error);
    } finally {
      signButton.disabled = false;
    }
  });
}
