import { describe, expect, it, vi } from "vitest";
import {
  AutoFirmaClient,
  fromBase64,
  isAutoScriptAvailable,
  type AutoScriptApi,
} from "../src/index.js";

describe("integration helpers", () => {
  it("decodifica resultados Base64 a bytes", () => {
    expect(fromBase64("JVBERi0=")).toEqual(
      new Uint8Array([37, 80, 68, 70, 45]),
    );
  });

  it("detecta AutoScript solo cuando expone una operación de firma válida", () => {
    globalThis.window = {
      AutoScript: { sign: () => undefined },
    } as unknown as Window & typeof globalThis;

    try {
      expect(isAutoScriptAvailable()).toBe(true);

      window.AutoScript = { tagName: "A" } as unknown as AutoScriptApi;
      expect(isAutoScriptAvailable()).toBe(false);
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it("configura nombre de aplicación e idioma cuando AutoScript los soporta", () => {
    const autoScript: AutoScriptApi = {
      sign: () => undefined,
      setAppName: vi.fn(),
      setLocale: vi.fn(),
    };

    new AutoFirmaClient({
      autoScript,
      appName: "Document signer",
      locale: "es_ES",
    });

    expect(autoScript.setAppName).toHaveBeenCalledWith("Document signer");
    expect(autoScript.setLocale).toHaveBeenCalledWith("es_ES");
  });

  it("mantiene compatibilidad con AutoScript sin opciones de configuración", () => {
    expect(
      () =>
        new AutoFirmaClient({
          autoScript: { sign: () => undefined },
          appName: "Document signer",
          locale: "es_ES",
        }),
    ).not.toThrow();
  });
});
