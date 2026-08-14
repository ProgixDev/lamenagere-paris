/**
 * Bundles three.js and OrbitControls into a single string the 3D step can
 * inline into its WebView.
 *
 * The renderer used to pull three from unpkg, which meant the configurator
 * broke without a connection and depended on a third party staying up. Metro
 * cannot reach inside an HTML string, so the bundle is generated here and
 * committed as an ordinary module; run `npm run build:three` after bumping the
 * three dependency.
 *
 *   node scripts/build-three-bundle.mjs
 */
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "lib", "kitchen3d", "three-bundle.ts");

// Only what the renderer touches, so tree-shaking can drop the rest of three.
const ENTRY = `
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// A procedurally built room, used through PMREM as the environment map. Without
// one, every metal and glossy surface renders dead flat — and it is generated,
// so it costs no asset and works offline.
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
globalThis.THREE = THREE;
globalThis.OrbitControls = OrbitControls;
globalThis.RoomEnvironment = RoomEnvironment;
`;

const result = await build({
  // Fed through stdin with resolveDir at the project root, so `three` resolves
  // against the app's own node_modules.
  stdin: { contents: ENTRY, resolveDir: ROOT, loader: "js" },
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["safari16", "chrome90"],
  legalComments: "none",
  absWorkingDir: ROOT,
  write: false,
});

// A literal </script> inside the payload would close the host tag early.
const code = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

writeFileSync(
  OUT,
  `/* eslint-disable */
// GENERATED FILE — do not edit. Run \`npm run build:three\` to regenerate.
// three.js + OrbitControls, bundled for inlining into the 3D step's WebView.
export const THREE_BUNDLE = ${JSON.stringify(code)};
`,
);

const kb = (Buffer.byteLength(code) / 1024).toFixed(0);
console.log(`wrote ${OUT} (${kb} KB)`);
