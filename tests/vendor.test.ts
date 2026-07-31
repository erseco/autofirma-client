import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../scripts/upstream.js";
import {
  verifyOrDownload,
  type UpstreamLock,
} from "../scripts/vendor-autoscript.js";

const CONTENT =
  'var VERSION = "1.9.0";\nvar VERSION_CODE = 3;\nvar PROTOCOL_VERSION = 4;\n';

function lockFor(content: string): UpstreamLock {
  return {
    repo: "ctt-gob-es/clienteafirma",
    tag: "v1.9.2",
    commit: "0".repeat(40),
    path: "afirma-ui-miniapplet-deploy/src/main/webapp/js/autoscript.js",
    sha256: sha256Hex(new TextEncoder().encode(content)),
    autoscript: { version: "1.9.0", versionCode: 3, protocolVersion: 4 },
  };
}

describe("verifyOrDownload", () => {
  it("descarga cuando no existe la copia local", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vendor-"));
    const destination = join(directory, "autoscript.js");
    const fake = async () => new Response(CONTENT, { status: 200 });

    const outcome = await verifyOrDownload(lockFor(CONTENT), destination, fake);

    expect(outcome).toBe("downloaded");
    expect(await readFile(destination, "utf8")).toBe(CONTENT);
  });

  it("no descarga si la copia local ya coincide", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vendor-"));
    const destination = join(directory, "autoscript.js");
    await writeFile(destination, CONTENT);
    const fail = async () => {
      throw new Error("no debería descargar");
    };

    expect(await verifyOrDownload(lockFor(CONTENT), destination, fail)).toBe(
      "cached",
    );
  });

  it("aborta cuando la huella no coincide", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vendor-"));
    const destination = join(directory, "autoscript.js");
    const fake = async () =>
      new Response("contenido manipulado", { status: 200 });

    await expect(
      verifyOrDownload(lockFor(CONTENT), destination, fake),
    ).rejects.toThrow(/sha256/i);
  });

  it("aborta cuando la descarga falla", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vendor-"));
    const destination = join(directory, "autoscript.js");
    const fake = async () => new Response("", { status: 404 });

    await expect(
      verifyOrDownload(lockFor(CONTENT), destination, fake),
    ).rejects.toThrow(/404/);
  });

  it("aborta cuando el fichero declara otra VERSION que el pin", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vendor-"));
    const destination = join(directory, "autoscript.js");
    const otra =
      'var VERSION = "1.10.1";\nvar VERSION_CODE = 4;\nvar PROTOCOL_VERSION = 4;\n';
    const lock = {
      ...lockFor(otra),
      autoscript: { version: "1.9.0", versionCode: 3, protocolVersion: 4 },
    };
    const fake = async () => new Response(otra, { status: 200 });

    await expect(verifyOrDownload(lock, destination, fake)).rejects.toThrow(
      /VERSION/,
    );
  });
});
