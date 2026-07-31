import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readCertificate } from "../web/certificate.js";

/**
 * `certificate.pem` es un certificado autofirmado v1 (sin la etiqueta `[0]`
 * de versión). `certificate-v3.pem` añade `-addext basicConstraints` para
 * forzar un certificado v3 con esa etiqueta presente, y así probar que el
 * lector la salta correctamente. Ambos se generaron con:
 *
 *   openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
 *     -keyout /dev/null -out tests/fixtures/certificate.pem \
 *     -subj "/C=ES/O=Ejemplo SL/CN=NOMBRE EJEMPLO EJEMPLO - 00000000T"
 *
 *   openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
 *     -keyout /dev/null -out tests/fixtures/certificate-v3.pem \
 *     -addext "basicConstraints=CA:TRUE" \
 *     -subj "/C=ES/O=Ejemplo SL/CN=NOMBRE EJEMPLO EJEMPLO - 00000000T"
 *
 * Los valores esperados en las pruebas son los que imprime:
 *   openssl x509 -in <fichero> -noout -subject -issuer -serial -dates
 */
function toDerBase64(pemPath: string): string {
  const pem = readFileSync(pemPath, "utf8");
  return pem
    .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
}

const derBase64 = toDerBase64("tests/fixtures/certificate.pem");
const derBase64V3 = toDerBase64("tests/fixtures/certificate-v3.pem");

/**
 * Construye un elemento DER de forma corta (longitud < 0x80, suficiente para
 * los datos sintéticos de estas pruebas).
 */
function derElement(tag: number, content: Uint8Array): Uint8Array {
  if (content.length >= 0x80) {
    throw new Error("Ayudante de prueba: contenido demasiado largo.");
  }
  return Uint8Array.from([tag, content.length, ...content]);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * Construye a mano un `Certificate` DER mínimo (sin `openssl`, que en este
 * entorno usa LibreSSL y no admite fijar fechas de vigencia arbitrarias vía
 * `-not_before`/`-not_after`) con las fechas de vigencia indicadas, para
 * poder probar el ventaneo de año de `UTCTime` con años anteriores a 2000.
 * `issuer` y `subject` se dejan como `Name` vacíos: no le importan a esta
 * prueba y un `RDNSequence` sin RDNs es DER válido.
 */
function buildMinimalCertificate(notBefore: string, notAfter: string): string {
  const serial = derElement(0x02, Uint8Array.from([0x01]));
  const signatureAlgorithm = derElement(0x30, new Uint8Array(0));
  const issuer = derElement(0x30, new Uint8Array(0));
  const validity = derElement(
    0x30,
    concat(derElement(0x17, utf8(notBefore)), derElement(0x17, utf8(notAfter))),
  );
  const subject = derElement(0x30, new Uint8Array(0));
  const tbsCertificate = derElement(
    0x30,
    concat(serial, signatureAlgorithm, issuer, validity, subject),
  );
  const certificate = derElement(0x30, tbsCertificate);
  return Buffer.from(certificate).toString("base64");
}

describe("readCertificate", () => {
  it("lee el titular", () => {
    expect(readCertificate(derBase64).subject).toContain(
      "NOMBRE EJEMPLO EJEMPLO - 00000000T",
    );
  });

  it("lee la emisora", () => {
    expect(readCertificate(derBase64).issuer).toContain("Ejemplo SL");
  });

  it("lee la vigencia", () => {
    const summary = readCertificate(derBase64);
    expect(summary.notBefore.getTime()).toBeLessThan(
      summary.notAfter.getTime(),
    );
  });

  it("lee el número de serie en hexadecimal", () => {
    expect(readCertificate(derBase64).serialNumber).toMatch(/^[0-9a-f]+$/);
    expect(readCertificate(derBase64).serialNumber).toBe("f80c3f8dedb0cfaf");
  });

  it("rechaza una entrada que no es un certificado", () => {
    // "bm8gZXMgdW4gY2VydGlmaWNhZG8=" es el base64 de "no es un certificado".
    // Su primer byte (0x6e) se lee como tag y el segundo (0x6f = 111) como
    // longitud en forma corta, así que el elemento declara una longitud de
    // 111 bytes cuando el buffer entero solo tiene 20: rechaza por la
    // comprobación de límites de `readElement` (buffer más corto de lo que
    // el propio elemento declara), no por la comprobación de etiqueta de
    // `Certificate` que viene después.
    expect(() => readCertificate("bm8gZXMgdW4gY2VydGlmaWNhZG8=")).toThrow(
      /certificado/i,
    );
  });

  it("rechaza una estructura DER bien formada pero con la etiqueta equivocada", () => {
    // INTEGER (tag 0x02) de longitud 3 con sus 3 bytes de contenido
    // presentes: el elemento en sí es DER válido y no dispara la
    // comprobación de límites, así que esta prueba sí ejercita la
    // comprobación de etiqueta `Certificate` (SEQUENCE, 0x30) del código.
    const notASequence = Uint8Array.from([0x02, 0x03, 0x01, 0x02, 0x03]);
    const derBase64NotASequence = Buffer.from(notASequence).toString("base64");
    expect(() => readCertificate(derBase64NotASequence)).toThrow(
      /certificado/i,
    );
  });

  it("interpreta UTCTime de dos dígitos según RFC 5280 (YY >= 50 => 19YY)", () => {
    const derBase64Synthetic = buildMinimalCertificate(
      "900101000000Z",
      "991231235959Z",
    );
    const summary = readCertificate(derBase64Synthetic);
    expect(summary.notBefore.getUTCFullYear()).toBe(1990);
    expect(summary.notAfter.getUTCFullYear()).toBe(1999);
  });

  it("lee un certificado v3 saltando la etiqueta [0] de versión", () => {
    const summary = readCertificate(derBase64V3);
    expect(summary.subject).toContain("NOMBRE EJEMPLO EJEMPLO - 00000000T");
    expect(summary.issuer).toContain("Ejemplo SL");
    expect(summary.serialNumber).toBe("b983a4f154eb6ad7");
    expect(summary.notBefore.getTime()).toBeLessThan(
      summary.notAfter.getTime(),
    );
  });
});
