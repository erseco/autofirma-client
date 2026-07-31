/**
 * Resumen del certificado que ha devuelto AutoFirma. No valida nada: describe
 * los campos que trae el propio certificado (titular, emisora, vigencia y
 * número de serie), extraídos con el mismo criterio que
 * `openssl x509 -noout -subject -issuer -serial -dates`, pero como texto
 * plano de los valores del nombre distinguido (sin los prefijos `C=`, `O=`,
 * `CN=` que añade `openssl`).
 */
export interface CertificateSummary {
  readonly subject: string;
  readonly issuer: string;
  readonly serialNumber: string;
  readonly notBefore: Date;
  readonly notAfter: Date;
}

/** Etiquetas DER relevantes para este recorrido mínimo del certificado. */
const TAG_SEQUENCE = 0x30;
const TAG_VERSION = 0xa0;
const TAG_GENERALIZED_TIME = 0x18;

interface Element {
  readonly tag: number;
  readonly content: Uint8Array;
  /** Posición, en el buffer que se le pasó a `readElement`, tras este elemento. */
  readonly end: number;
}

/**
 * Lee un elemento DER (tipo, longitud y contenido) en la posición indicada.
 *
 * Solo admite longitud definida, que es la única forma legal en DER: un
 * primer byte de longitud igual a `0x80` es la forma indefinida de BER y se
 * rechaza explícitamente en vez de interpretarse como longitud 128.
 */
function readElement(data: Uint8Array, offset: number): Element {
  const tag = data[offset];
  if (tag === undefined) {
    throw new Error("Estructura de certificado incompleta.");
  }

  let cursor = offset + 1;
  const first = data[cursor];
  if (first === undefined) {
    throw new Error("Estructura de certificado incompleta.");
  }
  cursor += 1;

  let length: number;
  if (first === 0x80) {
    throw new Error(
      "Longitud DER indefinida no admitida: no es un certificado válido.",
    );
  } else if (first > 0x80) {
    const lengthBytes = first & 0x7f;
    length = 0;
    for (let index = 0; index < lengthBytes; index += 1) {
      const byte = data[cursor];
      if (byte === undefined) {
        throw new Error("Estructura de certificado incompleta.");
      }
      length = length * 256 + byte;
      cursor += 1;
    }
  } else {
    length = first;
  }

  const end = cursor + length;
  if (end > data.length) {
    throw new Error("Estructura de certificado incompleta.");
  }

  return { tag, content: data.subarray(cursor, end), end };
}

/**
 * Convierte un `Name` (RDNSequence) en texto legible, de la parte más
 * específica a la más general. Asume, como es habitual en certificados de
 * persona/entidad, que cada RDN (`SET`) contiene un único
 * `AttributeTypeAndValue` (`SEQUENCE` con un OID y un valor de texto).
 */
function readName(data: Uint8Array): string {
  const parts: string[] = [];
  let offset = 0;
  while (offset < data.length) {
    const rdn = readElement(data, offset);
    const attribute = readElement(rdn.content, 0);
    const type = readElement(attribute.content, 0);
    const value = readElement(attribute.content, type.end);
    parts.push(new TextDecoder().decode(value.content));
    offset = rdn.end;
  }
  return parts.reverse().join(", ");
}

/**
 * Interpreta `UTCTime` (`YYMMDDHHMMSSZ`) y `GeneralizedTime`
 * (`YYYYMMDDHHMMSSZ`).
 *
 * Para `UTCTime`, el año de dos dígitos se interpreta según la regla de la
 * RFC 5280 (sección 4.1.2.5.1): `YY >= 50` es `19YY`, y `YY < 50` es `20YY`.
 */
function readTime(element: Element): Date {
  const text = new TextDecoder().decode(element.content);
  const isGeneralized = element.tag === TAG_GENERALIZED_TIME;
  const twoDigitYear = Number(text.slice(0, 2));
  const year = isGeneralized
    ? Number(text.slice(0, 4))
    : twoDigitYear >= 50
      ? 1900 + twoDigitYear
      : 2000 + twoDigitYear;
  const rest = isGeneralized ? text.slice(4) : text.slice(2);
  const month = Number(rest.slice(0, 2)) - 1;
  const day = Number(rest.slice(2, 4));
  const hour = Number(rest.slice(4, 6));
  const minute = Number(rest.slice(6, 8));
  const second = Number(rest.slice(8, 10));
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Convierte el contenido de un `INTEGER` DER en hexadecimal, quitando el
 * byte `0x00` de relleno que DER antepone cuando el bit más alto del primer
 * byte "real" está activo (para no confundirlo con un entero negativo en
 * complemento a dos). No se recorta ningún otro cero: un carácter '0' que
 * forme parte del valor real del número de serie debe conservarse.
 */
function serialToHex(content: Uint8Array): string {
  const hasPaddingByte =
    content.length > 1 && content[0] === 0x00 && (content[1] ?? 0) >= 0x80;
  const bytes = hasPaddingByte ? content.subarray(1) : content;
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Lee los datos descriptivos de un certificado X.509 en formato DER
 * codificado en base64, tal y como lo devuelve AutoScript junto a la firma.
 *
 * Recorre `Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm,
 * signatureValue }` y, dentro de `tbsCertificate`, el `version` opcional
 * (etiqueta `[0]`, solo presente en certificados v2/v3), `serialNumber`,
 * `issuer`, `validity` y `subject`. No valida la firma, la cadena de
 * confianza ni la revocación: solo describe lo que el propio certificado
 * declara.
 */
export function readCertificate(derBase64: string): CertificateSummary {
  let der: Uint8Array;
  try {
    const binary = atob(derBase64);
    der = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("El contenido no es un certificado X.509 válido.");
  }

  const certificate = readElement(der, 0);
  if (certificate.tag !== TAG_SEQUENCE) {
    throw new Error("El contenido no es un certificado X.509.");
  }

  const tbs = readElement(certificate.content, 0);
  if (tbs.tag !== TAG_SEQUENCE) {
    throw new Error("El contenido no es un certificado X.509.");
  }

  let offset = 0;
  const first = readElement(tbs.content, offset);
  if (first.tag === TAG_VERSION) {
    offset = first.end;
  }

  const serial = readElement(tbs.content, offset);
  const signatureAlgorithm = readElement(tbs.content, serial.end);
  const issuer = readElement(tbs.content, signatureAlgorithm.end);
  const validity = readElement(tbs.content, issuer.end);
  const subject = readElement(tbs.content, validity.end);

  const notBefore = readElement(validity.content, 0);
  const notAfter = readElement(validity.content, notBefore.end);

  return {
    subject: readName(subject.content),
    issuer: readName(issuer.content),
    serialNumber: serialToHex(serial.content),
    notBefore: readTime(notBefore),
    notAfter: readTime(notAfter),
  };
}
