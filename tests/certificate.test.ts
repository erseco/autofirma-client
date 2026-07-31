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
    expect(() => readCertificate("bm8gZXMgdW4gY2VydGlmaWNhZG8=")).toThrow(
      /certificado/i,
    );
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
