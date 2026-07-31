import { describe, expect, it } from "vitest";
import { buildUpdatedLock, describeChange } from "../scripts/check-upstream.js";
import type { UpstreamLock } from "../scripts/vendor-autoscript.js";

const current: UpstreamLock = {
  repo: "ctt-gob-es/clienteafirma",
  tag: "v1.9.2",
  commit: "a".repeat(40),
  path: "afirma-ui-miniapplet-deploy/src/main/webapp/js/autoscript.js",
  sha256: "0".repeat(64),
  autoscript: { version: "1.9.0", versionCode: 3, protocolVersion: 4 },
};

const source = [
  'var VERSION = "1.10.1";',
  "var VERSION_CODE = 4;",
  "var PROTOCOL_VERSION = 4;",
].join("\n");

describe("buildUpdatedLock", () => {
  it("conserva repositorio y ruta, y actualiza el resto", () => {
    const next = buildUpdatedLock(current, "v1.10", "b".repeat(40), source);

    expect(next.repo).toBe(current.repo);
    expect(next.path).toBe(current.path);
    expect(next.tag).toBe("v1.10");
    expect(next.commit).toBe("b".repeat(40));
    expect(next.autoscript).toEqual({
      version: "1.10.1",
      versionCode: 4,
      protocolVersion: 4,
    });
    expect(next.sha256).not.toBe(current.sha256);
    expect(next.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("describeChange", () => {
  it("resume el salto de versión y de tag", () => {
    const next = buildUpdatedLock(current, "v1.10", "b".repeat(40), source);
    const summary = describeChange(current, next);

    expect(summary).toContain("v1.9.2");
    expect(summary).toContain("v1.10");
    expect(summary).toContain("1.9.0");
    expect(summary).toContain("1.10.1");
  });
});
