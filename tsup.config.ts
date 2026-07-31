import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "testing/index": "src/testing/index.ts",
  },
  format: ["esm", "cjs"],
  // Las declaraciones las emite `tsc` con `tsconfig.build.json`: el generador de
  // tipos de tsup usa la API JavaScript del compilador, que TypeScript 7 ya no
  // publica. Ver ADR-0003.
  sourcemap: true,
  clean: true,
  target: "es2022",
});
