import { describe, expect, it, vi } from "vitest";
import {
  AutoFirmaClient,
  type AutoScriptApi,
  type SignBatchOptions,
} from "../src/index.js";
import { MockAutoFirmaClient } from "../src/testing/index.js";

// Contrato: AutoScript exports 4932–4936 y JSONBatchManager/LocalBatchSigner
// del commit b4fe147c322932ebdd11e25db3134af934e0e832 (v1.9.2).
const options: SignBatchOptions = {
  documents: [
    { id: "a", data: new Uint8Array([72, 105]) },
    { id: "b", data: "SGk=" },
  ],
  format: "PAdES",
  parameters: { layer2Text: "Sello", signaturePage: 1 },
};
const response = {
  signs: [
    { id: "b", result: "ERROR_PRE", description: "SAF_03" },
    { id: "a", result: "DONE_AND_SAVED", signature: "c2lnbmVk" },
  ],
};
function api(): AutoScriptApi {
  return {
    sign: vi.fn((_d, _a, _f, _p, success) => success("signed")),
    createBatch: vi.fn(),
    addDocumentToBatch: vi.fn(),
    setLocalBatchProcess: vi.fn(),
    signBatchProcess: vi.fn((_stop, _pre, _post, _filters, success) =>
      success(response, "cert"),
    ),
  };
}
describe("lotes locales", () => {
  it("envía parámetros comunes y conserva resultados parciales por ID", async () => {
    const native = api();
    await expect(
      new AutoFirmaClient({ autoScript: native }).signBatch(options),
    ).resolves.toEqual({ ...response, certificate: "cert" });
    expect(native.createBatch).toHaveBeenCalledWith(
      "SHA256withRSA",
      "PAdES",
      "sign",
      "layer2Text=Sello\nsignaturePage=1",
    );
    expect(native.addDocumentToBatch).toHaveBeenNthCalledWith(
      1,
      "a",
      "SGk=",
      null,
      null,
      null,
    );
    expect(native.addDocumentToBatch).toHaveBeenNthCalledWith(
      2,
      "b",
      "SGk=",
      null,
      null,
      null,
    );
    expect(native.signBatchProcess).toHaveBeenCalledWith(
      false,
      null,
      null,
      "",
      expect.any(Function),
      expect.any(Function),
    );
    expect(native.setLocalBatchProcess).toHaveBeenNthCalledWith(1, true);
    expect(native.setLocalBatchProcess).toHaveBeenLastCalledWith(false);
  });
  it("admite algoritmo, filtros y parada explícitos sin certificado de respuesta", async () => {
    const native = api();
    native.signBatchProcess = vi.fn((_s, _p, _o, _f, success) =>
      success(response),
    );
    await expect(
      new AutoFirmaClient({ autoScript: native }).signBatch({
        ...options,
        algorithm: "SHA512withRSA",
        stopOnError: true,
        certificateFilters: { filters: "nonexpired:" },
      }),
    ).resolves.toEqual(response);
    expect(native.createBatch).toHaveBeenCalledWith(
      "SHA512withRSA",
      "PAdES",
      "sign",
      expect.any(String),
    );
    expect(native.signBatchProcess).toHaveBeenCalledWith(
      true,
      null,
      null,
      "filters=nonexpired:",
      expect.any(Function),
      expect.any(Function),
    );
  });
  it.each([
    "createBatch",
    "addDocumentToBatch",
    "setLocalBatchProcess",
    "signBatchProcess",
  ] as const)("rechaza si falta %s", async (method) => {
    const native = api();
    delete native[method];
    await expect(
      new AutoFirmaClient({ autoScript: native }).signBatch(options),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
  });
  it.each(
    [
      [],
      [{ id: "", data: "AA==" }],
      [{ id: " ", data: "AA==" }],
      [
        { id: "a", data: "AA==" },
        { id: "a", data: "AA==" },
      ],
      [{ id: 1, data: "AA==" }],
    ].map((documents) => [documents]),
  )("rechaza IDs inválidos: %j", async (documents) => {
    const native = api();
    await expect(
      new AutoFirmaClient({ autoScript: native }).signBatch({
        ...options,
        documents,
      } as SignBatchOptions),
    ).rejects.toMatchObject({ code: "INVALID_BATCH" });
    expect(native.createBatch).not.toHaveBeenCalled();
  });
  it.each([
    null,
    {},
    { signs: [] },
    ...[
      null,
      { id: 1, result: "SKIPPED" },
      response.signs[1],
      { id: "other", result: "SKIPPED" },
      { id: "b", result: 1 },
      { id: "b", result: "ERROR_PRE", description: 1 },
      { id: "b", result: "DONE_AND_SAVED", signature: 1 },
      { id: "b", result: "DONE_AND_SAVED" },
    ].map((item) => ({ signs: [item, response.signs[1]] })),
  ])("rechaza respuestas ambiguas: %j", async (data) => {
    const native = api();
    native.signBatchProcess = (_s, _p, _o, _f, success) => success(data);
    await expect(
      new AutoFirmaClient({ autoScript: native }).signBatch(options),
    ).rejects.toMatchObject({ code: "INVALID_BATCH_RESPONSE" });
    expect(native.setLocalBatchProcess).toHaveBeenLastCalledWith(false);
  });
  it.each([true, false])(
    "libera el estado tras error nativo (callback: %s)",
    async (callback) => {
      const native = api();
      native.signBatchProcess = (_s, _p, _o, _f, _success, failure) => {
        if (callback) failure("AOCancelledOperationException", "Cancelado");
        else throw new Error("native failure");
      };
      const client = new AutoFirmaClient({ autoScript: native });
      await expect(client.signBatch(options)).rejects.toThrow();
      expect(native.setLocalBatchProcess).toHaveBeenLastCalledWith(false);
      await expect(
        client.sign({ data: "AA==", format: "PAdES" }),
      ).resolves.toEqual({ signature: "signed" });
    },
  );
  it("rechaza solapamientos entre clientes antes de convertir datos", async () => {
    const native = api();
    const client = new AutoFirmaClient({ autoScript: native });
    const other = new AutoFirmaClient({ autoScript: native });
    const pending = client.signBatch(options);
    await expect(other.signBatch(options)).rejects.toMatchObject({
      code: "OPERATION_IN_PROGRESS",
    });
    await pending;
    const single = client.sign({ data: new Blob(["Hi"]), format: "PAdES" });
    await expect(other.signBatch(options)).rejects.toMatchObject({
      code: "OPERATION_IN_PROGRESS",
    });
    await single;
  });
  it("incluye lotes en el doble de prueba", async () => {
    for (const result of [
      { signature: "signed" },
      { signature: "signed", certificate: "cert" },
    ]) {
      const client = new MockAutoFirmaClient(result);
      const batch = await client.signBatch(options);
      expect(batch.signs.map(({ id }) => id)).toEqual(["a", "b"]);
      expect(batch.signs.every(({ signature }) => signature === "signed")).toBe(
        true,
      );
      expect(client.batchCalls).toEqual([options]);
    }
  });
});
