import { describe, expect, it, vi } from "vitest";
import {
  AutoFirmaClient,
  AutoFirmaError,
  AutoScriptUnavailableError,
  serializeParameters,
  toBase64,
  type AutoScriptApi,
} from "../src/index.js";
import { MockAutoFirmaClient } from "../src/testing/index.js";

function createApi(): AutoScriptApi {
  return {
    sign: vi.fn((_data, _algorithm, _format, _parameters, success) =>
      success("signed", "certificate", "extra"),
    ),
    coSign: vi.fn((_data, _algorithm, _format, _parameters, success) =>
      success("cosigned"),
    ),
    counterSign: vi.fn((_data, _algorithm, _format, _parameters, success) =>
      success("countersigned"),
    ),
    selectCertificate: vi.fn((_parameters, success) => success("certificate")),
    cargarAppAfirma: vi.fn(),
    setServlets: vi.fn(),
  };
}

describe("AutoFirmaClient", () => {
  it("adapta sign a una promesa y normaliza opciones", async () => {
    const api = createApi();
    const client = new AutoFirmaClient({ autoScript: api });

    await expect(
      client.sign({
        data: new Uint8Array([72, 105]),
        format: "PAdES",
        parameters: { mode: "implicit", visible: true },
      }),
    ).resolves.toEqual({
      signature: "signed",
      certificate: "certificate",
      extraData: "extra",
    });

    expect(api.sign).toHaveBeenCalledWith(
      "SGk=",
      "SHA256withRSA",
      "PAdES",
      "mode=implicit\nvisible=true",
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("configura servlets únicamente cuando recibe ambas URL", () => {
    const api = createApi();
    const client = new AutoFirmaClient({
      autoScript: api,
      storageUrl: "/storage",
      retrieveUrl: "/retrieve",
    });

    client.initialize();

    expect(api.setServlets).toHaveBeenCalledWith("/storage", "/retrieve");
    expect(api.cargarAppAfirma).toHaveBeenCalledOnce();
    expect(client.raw).toBe(api);
  });

  it("expone cofirma, contrafirma y selección de certificado", async () => {
    const client = new AutoFirmaClient({ autoScript: createApi() });
    const options = { data: "ZGF0YQ==", format: "CAdES" } as const;

    await expect(client.coSign(options)).resolves.toEqual({
      signature: "cosigned",
    });
    await expect(client.counterSign(options)).resolves.toEqual({
      signature: "countersigned",
    });
    await expect(
      client.selectCertificate({ filters: "nonexpired:" }),
    ).resolves.toEqual({ certificate: "certificate" });
  });

  it("rechaza operaciones no expuestas por AutoScript", async () => {
    const client = new AutoFirmaClient({
      autoScript: { sign: createApi().sign },
    });

    await expect(
      client.coSign({ data: "", format: "CAdES" }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
    await expect(client.selectCertificate()).rejects.toMatchObject({
      code: "UNSUPPORTED_OPERATION",
    });
  });

  it("normaliza errores nativos y conserva el detalle", async () => {
    const client = new AutoFirmaClient({
      autoScript: {
        sign: (_data, _algorithm, _format, _parameters, _success, failure) =>
          failure("AOCancelledOperationException", "Operación cancelada"),
      },
    });

    await expect(
      client.sign({ data: "", format: "PAdES" }),
    ).rejects.toMatchObject({
      code: "USER_CANCELLED",
      nativeType: "AOCancelledOperationException",
    });
  });
});

describe("utilidades", () => {
  it("serializa valores y elimina saltos de línea en valores", () => {
    expect(
      serializeParameters({
        page: 1,
        enabled: false,
        note: "línea 1\nlínea 2",
        omitted: undefined,
      }),
    ).toBe("page=1\nenabled=false\nnote=línea 1 línea 2");
  });

  it("rechaza claves ambiguas", () => {
    expect(() => serializeParameters({ "bad=key": true })).toThrow(TypeError);
  });

  it("mantiene cadenas Base64 y convierte ArrayBuffer y Blob", async () => {
    await expect(toBase64("YWJj")).resolves.toBe("YWJj");
    await expect(toBase64(new Uint8Array([97, 98, 99]).buffer)).resolves.toBe(
      "YWJj",
    );
    await expect(toBase64(new Blob(["abc"]))).resolves.toBe("YWJj");
  });

  it("falla claramente si AutoScript no está disponible", () => {
    expect(() => new AutoFirmaClient()).toThrow(AutoScriptUnavailableError);
  });

  it("no acepta un global que no sea la API de AutoScript", () => {
    // `<a id="AutoScript">` define `window.AutoScript` sin ejecutar ningún
    // script. Aceptarlo dejaba el cliente con un elemento en vez de la API y
    // la firma fallaba mucho después con un TypeError sin `code`.
    globalThis.window = {
      AutoScript: { tagName: "A" },
    } as unknown as Window & typeof globalThis;

    try {
      expect(() => new AutoFirmaClient()).toThrow(AutoScriptUnavailableError);
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it("distingue errores nativos no cancelados", async () => {
    const client = new AutoFirmaClient({
      autoScript: {
        sign: (_data, _algorithm, _format, _parameters, _success, failure) =>
          failure("NativeError", "No se pudo firmar"),
      },
    });

    try {
      await client.sign({ data: "", format: "PAdES" });
    } catch (error) {
      expect(error).toBeInstanceOf(AutoFirmaError);
      expect(error).toMatchObject({ code: "NATIVE_ERROR" });
    }
  });

  it("ofrece un cliente mock determinista para consumidores", async () => {
    const client = new MockAutoFirmaClient({
      signature: "test-signature",
    });
    const options = { data: "ZGF0YQ==", format: "CAdES" } as const;

    await expect(client.sign(options)).resolves.toEqual({
      signature: "test-signature",
    });
    await expect(client.coSign(options)).resolves.toEqual({
      signature: "test-signature",
    });
    await expect(client.counterSign(options)).resolves.toEqual({
      signature: "test-signature",
    });
    await expect(client.selectCertificate()).resolves.toEqual({
      certificate: "mock-certificate",
    });
    expect(client.calls).toEqual([options, options, options]);
  });
});

describe("operaciones auxiliares", () => {
  it("guarda datos delegando en AutoScript", async () => {
    const calls: string[] = [];
    const autoScript = {
      sign: () => undefined,
      saveDataToFile: (
        data: string,
        title: string,
        filename: string,
        extension: string,
        description: string,
        success: () => void,
      ) => {
        calls.push(data, title, filename, extension, description);
        success();
      },
    } as unknown as AutoScriptApi;

    await new AutoFirmaClient({ autoScript }).saveDataToFile({
      data: "ZGF0b3M=",
      title: "Guardar firma",
      filename: "firma.csig",
      extension: "csig",
      description: "Firma CAdES",
    });

    expect(calls).toEqual([
      "ZGF0b3M=",
      "Guardar firma",
      "firma.csig",
      "csig",
      "Firma CAdES",
    ]);
  });

  it("rechaza guardar datos cuando la versión fijada no expone la operación", async () => {
    const autoScript = { sign: () => undefined } as unknown as AutoScriptApi;

    await expect(
      new AutoFirmaClient({ autoScript }).saveDataToFile({
        data: "ZGF0b3M=",
        title: "Guardar firma",
        filename: "firma.csig",
        extension: "csig",
        description: "Firma CAdES",
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
  });

  it("rechaza cuando la versión fijada no expone la operación", async () => {
    const autoScript = { sign: () => undefined } as unknown as AutoScriptApi;

    await expect(
      new AutoFirmaClient({ autoScript }).checkTime(),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
  });

  it("comprueba la hora con los valores por defecto, sin imponer un maxMillis propio", async () => {
    const received: unknown[] = [];
    const autoScript = {
      sign: () => undefined,
      checkTime: (checkType: string, maxMillis?: number) => {
        received.push(checkType, maxMillis);
      },
    } as unknown as AutoScriptApi;

    await new AutoFirmaClient({ autoScript }).checkTime();

    expect(received).toEqual(["CT_RECOMMENDED", undefined]);
  });
});
