import { describe, expect, it } from "vitest";
import { loadAutoScript } from "../src/loader.js";
import type { AutoScriptApi } from "../src/types.js";

interface FakeScript {
  src: string;
  async: boolean;
  onload?: () => void;
  onerror?: () => void;
}

function fakeDocument(onAppend: (script: FakeScript) => void): Document {
  const script: FakeScript = { src: "", async: false };
  return {
    createElement: () => script,
    head: { appendChild: () => onAppend(script) },
  } as unknown as Document;
}

const api = { sign: () => undefined } as unknown as AutoScriptApi;

/**
 * Lo que deja en `window.AutoScript` un `<a id="AutoScript">` inyectado en el
 * HTML: un elemento, no la API. No hace falta ejecutar ningún script para que
 * aparezca, así que un saneador que permita `id` —lo habitual— no lo impide.
 */
const clobbered = { tagName: "A" } as unknown as AutoScriptApi;

describe("loadAutoScript", () => {
  it("resuelve con el global cuando el script carga", async () => {
    globalThis.window = { AutoScript: undefined } as unknown as Window &
      typeof globalThis;
    const document = fakeDocument((script) => {
      globalThis.window.AutoScript = api;
      script.onload?.();
    });

    await expect(loadAutoScript("/autoscript.js", { document })).resolves.toBe(
      api,
    );
  });

  it("rechaza cuando el script carga pero no define el global", async () => {
    globalThis.window = { AutoScript: undefined } as unknown as Window &
      typeof globalThis;
    const document = fakeDocument((script) => script.onload?.());

    await expect(
      loadAutoScript("/autoscript.js", { document }),
    ).rejects.toThrow(/no es la API/i);
  });

  it("rechaza cuando la descarga falla", async () => {
    globalThis.window = { AutoScript: undefined } as unknown as Window &
      typeof globalThis;
    const document = fakeDocument((script) => script.onerror?.());

    await expect(
      loadAutoScript("/autoscript.js", { document }),
    ).rejects.toThrow(/no se pudo cargar/i);
  });

  it("devuelve el global sin volver a insertar el script", async () => {
    globalThis.window = { AutoScript: api } as unknown as Window &
      typeof globalThis;
    const document = fakeDocument(() => {
      throw new Error("no debería insertar nada");
    });

    await expect(loadAutoScript("/autoscript.js", { document })).resolves.toBe(
      api,
    );
  });

  it("inserta el script aunque el global exista, si no es la API", async () => {
    globalThis.window = { AutoScript: clobbered } as unknown as Window &
      typeof globalThis;
    const document = fakeDocument((script) => {
      globalThis.window.AutoScript = api;
      script.onload?.();
    });

    await expect(loadAutoScript("/autoscript.js", { document })).resolves.toBe(
      api,
    );
  });

  it("rechaza cuando el script carga pero el global no es la API", async () => {
    globalThis.window = { AutoScript: undefined } as unknown as Window &
      typeof globalThis;
    const document = fakeDocument((script) => {
      globalThis.window.AutoScript = clobbered;
      script.onload?.();
    });

    await expect(
      loadAutoScript("/autoscript.js", { document }),
    ).rejects.toThrow(/no es la API/i);
  });

  it("rechaza cuando no hay ningún documento disponible", async () => {
    globalThis.window = { AutoScript: undefined } as unknown as Window &
      typeof globalThis;

    await expect(loadAutoScript("/autoscript.js")).rejects.toMatchObject({
      code: "AUTOSCRIPT_UNAVAILABLE",
    });
  });
});
