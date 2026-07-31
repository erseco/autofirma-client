import { defineConfig } from "tsup";

export default defineConfig({
  entry: { demo: "web/demo.ts" },
  format: ["esm"],
  outDir: "site",
  target: "es2022",
  clean: true,
});
