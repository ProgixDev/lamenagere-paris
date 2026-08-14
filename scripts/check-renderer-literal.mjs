/**
 * Guards the one mistake this file invites.
 *
 * `renderer-html.ts` is a single template literal holding the whole three.js
 * page, so a backtick anywhere inside it — including in a comment, which is
 * where it keeps happening — silently ends the string, and a stray ${…} is
 * evaluated as host code. tsc catches the first case only when the count is
 * odd; this catches both, and says why.
 */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../lib/kitchen3d/renderer-html.ts", import.meta.url), "utf8");
const marker = "export const RENDERER_HTML = `";
const body = src.slice(src.indexOf(marker) + marker.length, src.lastIndexOf("`;"));

const ticks = (body.match(/`/g) || []).length;
const interps = (body.match(/\$\{/g) || []).length - (body.match(/\$\{THREE_BUNDLE\}/g) || []).length;

if (ticks || interps) {
  console.error(
    `renderer-html.ts: ${ticks} backtick(s) and ${interps} unexpected \${…} inside the HTML literal.\n` +
    "Backticks in comments end the template early — write them without.",
  );
  process.exit(1);
}
console.log("renderer literal OK — no stray backticks or interpolations");
