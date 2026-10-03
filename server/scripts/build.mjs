// Bundles the server (and @lorota/shared, which ships as TypeScript) into dist/index.js.
// Runtime dependencies stay external and are loaded from node_modules.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  external: Object.keys(pkg.dependencies),
});
console.log("server built to dist/index.js");
