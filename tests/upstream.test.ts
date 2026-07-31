import { describe, expect, it } from "vitest";
import {
  normalizeTagVersion,
  parseAutoscriptConstants,
  selectLatestTag,
  sha256Hex,
} from "../scripts/upstream.js";

describe("selectLatestTag", () => {
  it("descarta el legado y las candidatas a versión", () => {
    const tags = [
      "v1.8.3",
      "v1.9",
      "v1.9.1",
      "v1.9.2",
      "v1.9_RC",
      "OT_22250",
      "Version_1.7",
    ];
    expect(selectLatestTag(tags)).toBe("v1.9.2");
  });

  it("ordena numéricamente y no alfabéticamente", () => {
    expect(selectLatestTag(["v1.9.9", "v1.9.10"])).toBe("v1.9.10");
  });

  it("prefiere el patch sobre la línea sin patch", () => {
    expect(selectLatestTag(["v1.9", "v1.9.1"])).toBe("v1.9.1");
  });

  it("falla cuando no hay ningún tag válido", () => {
    expect(() => selectLatestTag(["OT_1"])).toThrow(/ningún tag/i);
  });
});

describe("normalizeTagVersion", () => {
  it("completa el tercer componente ausente", () => {
    expect(normalizeTagVersion("v1.9")).toBe("1.9.0");
  });

  it("conserva la versión completa", () => {
    expect(normalizeTagVersion("v1.9.2")).toBe("1.9.2");
  });
});

describe("parseAutoscriptConstants", () => {
  const source = [
    "var AutoScript = ( function ( window, undefined ) {",
    '\t\tvar VERSION = "1.9.0";',
    "\t\tvar VERSION_CODE = 3;",
    "\t\t\tvar PROTOCOL_VERSION = 4;",
  ].join("\n");

  it("lee las tres constantes", () => {
    expect(parseAutoscriptConstants(source)).toEqual({
      version: "1.9.0",
      versionCode: 3,
      protocolVersion: 4,
    });
  });

  it("falla si falta alguna constante", () => {
    expect(() => parseAutoscriptConstants('var VERSION = "1.9.0";')).toThrow(
      /VERSION_CODE/,
    );
  });
});

describe("sha256Hex", () => {
  it("calcula la huella conocida de una cadena vacía", () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
