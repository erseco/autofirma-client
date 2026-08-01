import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AutoFirmaClient,
  AutoFirmaError,
  AutoScriptUnavailableError,
  toBase64,
  type AutoScriptApi,
} from "../src/index.js";
import { MockAutoFirmaClient } from "../src/testing/index.js";
import { resolveAutoScript } from "../src/autoscript-adapter.js";

/**
 * Los caminos que solo se recorren cuando algo va mal o falta.
 *
 * Son los que nadie ejecuta a mano y, precisamente por eso, los que se rompen
 * sin que nadie se entere.
 */
describe("conversión a Base64", () => {
  // `toBase64` es asíncrona, así que no lanza: rechaza la promesa.
  it("rechaza un tipo de dato que no sabe convertir", async () => {
    await expect(toBase64(42 as unknown as string)).rejects.toBeInstanceOf(
      TypeError,
    );
    await expect(toBase64({} as unknown as string)).rejects.toThrow(
      "Tipo de dato no compatible.",
    );
  });

  it("avisa cuando el entorno no ofrece codificación Base64", async () => {
    const original = globalThis.btoa;

    // Un navegador antiguo o un entorno recortado pueden no traerla. El
    // mensaje tiene que decirlo, no fallar con un ReferenceError críptico.
    Reflect.deleteProperty(globalThis, "btoa");

    try {
      await expect(toBase64(new Uint8Array([1, 2, 3]))).rejects.toThrow(
        "El entorno no proporciona una función Base64 compatible.",
      );
    } finally {
      globalThis.btoa = original;
    }
  });
});

describe("resolución de AutoScript", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("toma el objeto global cuando el navegador ya lo tiene cargado", () => {
    const api: AutoScriptApi = { sign: vi.fn() };
    (globalThis as Record<string, unknown>).window = { AutoScript: api };

    expect(resolveAutoScript()).toBe(api);
  });

  it("se queja si el objeto global no es AutoScript", () => {
    (globalThis as Record<string, unknown>).window = {
      AutoScript: { noEsAutoScript: true },
    };

    expect(() => resolveAutoScript()).toThrow(AutoScriptUnavailableError);
  });
});

describe("errores nativos en operaciones opcionales", () => {
  it("propaga el fallo al elegir certificado", async () => {
    const api: AutoScriptApi = {
      sign: vi.fn(),
      selectCertificate: vi.fn((_parameters, _success, failure) =>
        failure(
          "es.gob.afirma.core.AOCancelledOperationException",
          "cancelado",
        ),
      ),
    };

    await expect(
      new AutoFirmaClient({ autoScript: api }).selectCertificate(),
    ).rejects.toBeInstanceOf(AutoFirmaError);
  });

  it("propaga el fallo al guardar un fichero", async () => {
    const api: AutoScriptApi = {
      sign: vi.fn(),
      saveDataToFile: vi.fn(
        (
          _data,
          _title,
          _filename,
          _extension,
          _description,
          _success,
          failure,
        ) => failure("java.io.IOException", "sin espacio"),
      ),
    };

    await expect(
      new AutoFirmaClient({ autoScript: api }).saveDataToFile({
        data: "ZGF0b3M=",
        title: "Guardar",
        filename: "documento.pdf",
        extension: "pdf",
        description: "Documento firmado",
      }),
    ).rejects.toBeInstanceOf(AutoFirmaError);
  });

  it("completa el guardado cuando AutoFirma responde bien", async () => {
    const api: AutoScriptApi = {
      sign: vi.fn(),
      saveDataToFile: vi.fn(
        (_data, _title, _filename, _extension, _description, success) =>
          success(),
      ),
    };

    await expect(
      new AutoFirmaClient({ autoScript: api }).saveDataToFile({
        data: "ZGF0b3M=",
        title: "Guardar",
        filename: "documento.pdf",
        extension: "pdf",
        description: "Documento firmado",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("doble de prueba", () => {
  it("registra lo que se le pide guardar", async () => {
    const client = new MockAutoFirmaClient();

    await client.saveDataToFile({
      data: "ZGF0b3M=",
      title: "Guardar",
      filename: "documento.pdf",
      extension: "pdf",
      description: "Documento firmado",
    });

    const [primero] = client.saved;

    expect(client.saved).toHaveLength(1);
    expect(primero?.filename).toBe("documento.pdf");
  });

  it("acepta la comprobación de hora sin hacer nada", async () => {
    await expect(
      new MockAutoFirmaClient().checkTime(),
    ).resolves.toBeUndefined();
  });

  it("devuelve el certificado que se le haya configurado", async () => {
    const client = new MockAutoFirmaClient({
      signature: "mi-firma",
      certificate: "mi-certificado",
    });

    await expect(client.selectCertificate()).resolves.toEqual({
      certificate: "mi-certificado",
    });
  });
});
