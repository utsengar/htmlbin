import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    bin: "src/bin.ts",
    index: "src/index.ts",
  },
  format: ["esm", "cjs"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: true,
  dts: { entry: { index: "src/index.ts" } },
  splitting: false,
  shims: false,
  banner: ({ format }) =>
    format === "cjs" ? { js: "#!/usr/bin/env node" } : { js: "#!/usr/bin/env node" },
});
