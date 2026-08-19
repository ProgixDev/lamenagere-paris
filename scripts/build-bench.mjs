/**
 * Builds a standalone browser bench for the 3D kitchen.
 *
 *   npm run bench      -> bench/kitchen.html, then open it
 *
 * The point is to design without the simulator. The page carries the *real*
 * `buildScene`, the real catalogue and the real renderer, bundled in, so what
 * it draws is what the app draws — change `scene.ts` or `renderer-html.ts`,
 * re-run this, refresh. Nothing is mocked and nothing is duplicated.
 *
 * The renderer is a whole HTML document, so it goes in an iframe fed from a
 * Blob URL. The bench holds the scene, the iframe draws it, and the messages
 * the renderer would post to React Native are forwarded back here and applied
 * through the same `edit.ts` the app uses — so dragging behaves identically.
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "bench");
const OUT = join(OUT_DIR, "kitchen.html");

const ENTRY = `
import { buildScene } from "./lib/kitchen3d/scene";
import { MODULES, moduleById } from "./lib/kitchen3d/catalog";
import { RENDERER_HTML } from "./lib/kitchen3d/renderer-html";
import {
  addModule, applyEdits, editsOfScene, fitsOnRun, ILOT_KEY, moveIlot,
  moveModule, moveRun, removeModule, rotateRun, runIndexOfKey,
} from "./lib/kitchen3d/edit";
import { layoutOfScene, moduleCount } from "./lib/kitchen3d/selection";
import { sceneTotalCents } from "./lib/kitchen3d/scene";

globalThis.KITCHEN = {
  buildScene, MODULES, moduleById, RENDERER_HTML,
  addModule, applyEdits, editsOfScene, fitsOnRun, ILOT_KEY, moveIlot,
  moveModule, moveRun, removeModule, rotateRun, runIndexOfKey,
  layoutOfScene, moduleCount, sceneTotalCents,
};
`;

const bundled = await build({
  stdin: { contents: ENTRY, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome100", "safari16"],
  minify: false,
  write: false,
  absWorkingDir: ROOT,
});

// A literal </script> anywhere in the payload would close the host tag early.
const code = bundled.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const PAGE = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Bench cuisine 3D — LA MÉNAGÈRE PARIS</title>
<style>
  :root {
    --bg:#14181C; --panel:#1B2026; --line:#2A323B; --ink:#E7EBEF;
    --muted:#94A0AC; --accent:#6FA3FF; --warn:#E5342B;
    --sans:-apple-system,system-ui,"Segoe UI",sans-serif;
  }
  * { box-sizing:border-box; }
  html,body { margin:0; height:100%; background:var(--bg); color:var(--ink); font-family:var(--sans); }
  #app { display:grid; grid-template-columns:302px 1fr; height:100%; }

  #side { border-right:1px solid var(--line); overflow-y:auto; background:var(--panel); }
  #side header { padding:16px 16px 12px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--panel); z-index:2; }
  #side h1 { margin:0; font-size:13px; letter-spacing:.14em; text-transform:uppercase; font-weight:600; }
  #side header p { margin:5px 0 0; font-size:11.5px; color:var(--muted); line-height:1.5; }

  .group { padding:14px 16px; border-bottom:1px solid var(--line); }
  .group h2 { margin:0 0 10px; font-size:10.5px; letter-spacing:.15em; text-transform:uppercase; color:var(--muted); font-weight:600; }
  .row { display:flex; align-items:center; gap:10px; margin-bottom:9px; }
  .row:last-child { margin-bottom:0; }
  .row label { flex:0 0 96px; font-size:12px; color:var(--muted); }
  .row output { flex:0 0 52px; font-size:12px; font-variant-numeric:tabular-nums; text-align:right; }
  input[type=range] { flex:1; min-width:0; accent-color:var(--accent); }
  input[type=color] { width:38px; height:24px; padding:0; border:1px solid var(--line); border-radius:5px; background:none; }

  .seg { display:flex; gap:6px; }
  .seg button {
    flex:1; padding:7px 0; font-size:12px; font-weight:600; font-family:inherit;
    color:var(--muted); background:#232A31; border:1px solid var(--line);
    border-radius:7px; cursor:pointer;
  }
  .seg button[aria-pressed="true"] { background:var(--accent); border-color:var(--accent); color:#0B1015; }

  .check { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--ink); cursor:pointer; }
  .check input { accent-color:var(--accent); }

  .act { display:flex; gap:6px; flex-wrap:wrap; }
  .act button {
    padding:7px 11px; font-size:11.5px; font-weight:600; font-family:inherit;
    color:var(--ink); background:#232A31; border:1px solid var(--line);
    border-radius:7px; cursor:pointer;
  }
  .act button:hover { border-color:var(--accent); color:var(--accent); }

  #stage { position:relative; }
  iframe { border:0; width:100%; height:100%; display:block; background:#EFEDE9; }
  #hud {
    position:absolute; left:14px; top:14px; display:flex; gap:8px; flex-wrap:wrap;
    font-size:11.5px; pointer-events:none;
  }
  #hud span {
    background:rgba(20,24,28,.82); border:1px solid rgba(255,255,255,.12);
    padding:4px 9px; border-radius:999px; backdrop-filter:blur(6px);
  }
  #hud .bad { background:rgba(229,52,43,.9); border-color:transparent; }
  #sel {
    position:absolute; left:14px; bottom:14px; right:14px; font-size:11.5px;
    background:rgba(20,24,28,.82); border:1px solid rgba(255,255,255,.12);
    padding:8px 11px; border-radius:10px; backdrop-filter:blur(6px);
    display:flex; align-items:center; gap:10px; justify-content:space-between;
  }
  #sel button {
    font:inherit; font-size:11px; font-weight:600; padding:4px 9px; border-radius:6px;
    background:#232A31; color:var(--ink); border:1px solid var(--line); cursor:pointer;
  }
  #sel .hint { color:var(--muted); }
</style>
</head>
<body>
<div id="app">
  <div id="side">
    <header>
      <h1>Bench cuisine 3D</h1>
      <p>Le vrai moteur, dans le navigateur. Modifiez, la scène se reconstruit.
         Glissez dans la vue comme dans l'app.</p>
    </header>

    <div class="group">
      <h2>Forme</h2>
      <div class="seg" id="shape">
        <button data-k="i" aria-pressed="false">I</button>
        <button data-k="l" aria-pressed="true">L</button>
        <button data-k="u" aria-pressed="false">U</button>
      </div>
    </div>

    <div class="group">
      <h2>Cuisine</h2>
      <div class="row"><label>Mur 1</label><input type="range" id="run1" min="120" max="600" step="10" value="360"><output id="run1o"></output></div>
      <div class="row"><label>Mur 2</label><input type="range" id="run2" min="60" max="500" step="10" value="240"><output id="run2o"></output></div>
      <div class="row"><label>Mur 3</label><input type="range" id="run3" min="60" max="500" step="10" value="240"><output id="run3o"></output></div>
      <div class="row"><label>Rotation</label>
        <div class="seg" style="flex:1">
          <button data-q="0" aria-pressed="true">0°</button>
          <button data-q="1" aria-pressed="false">90°</button>
          <button data-q="2" aria-pressed="false">180°</button>
          <button data-q="3" aria-pressed="false">270°</button>
        </div>
      </div>
    </div>

    <div class="group">
      <h2>Pièce</h2>
      <div class="row"><label>Longueur</label><input type="range" id="roomL" min="200" max="900" step="10" value="500"><output id="roomLo"></output></div>
      <div class="row"><label>Largeur</label><input type="range" id="roomW" min="200" max="900" step="10" value="400"><output id="roomWo"></output></div>
    </div>

    <div class="group">
      <h2>Îlot</h2>
      <label class="check" style="margin-bottom:9px"><input type="checkbox" id="ilot"> Îlot central</label>
      <div class="row"><label>Longueur</label><input type="range" id="ilotL" min="80" max="360" step="10" value="180"><output id="ilotLo"></output></div>
      <div class="row"><label>Largeur</label><input type="range" id="ilotW" min="60" max="160" step="10" value="90"><output id="ilotWo"></output></div>
      <div class="row"><label>Pivot</label>
        <div class="seg" style="flex:1">
          <button data-iq="0" aria-pressed="true">0°</button>
          <button data-iq="1" aria-pressed="false">90°</button>
        </div>
      </div>
    </div>

    <div class="group">
      <h2>Matières</h2>
      <div class="row"><label>Façades</label><input type="color" id="facade" value="#E8E4DC"></div>
      <div class="row"><label>Plan</label><input type="color" id="worktop" value="#2E2E30"></div>
      <label class="check"><input type="checkbox" id="credence" checked> Crédence</label>
    </div>

    <div class="group">
      <h2>Hauteurs</h2>
      <div class="row"><label>Plafond</label><input type="range" id="ceil" min="200" max="300" step="5" value="210"><output id="ceilo"></output></div>
      <div class="row"><label>Plan travail</label><input type="range" id="wtop" min="80" max="120" step="1" value="90"><output id="wtopo"></output></div>
    </div>

    <div class="group">
      <h2>Actions</h2>
      <div class="act">
        <button id="reset">Réinitialiser l'implantation</button>
        <button id="reload">Recharger le rendu</button>
        <button id="dump">Copier le JSON</button>
      </div>
    </div>
  </div>

  <div id="stage">
    <iframe id="view" title="Rendu 3D"></iframe>
    <div id="hud"></div>
    <div id="sel">
      <span id="selText" class="hint">Touchez un côté de la cuisine — puis à nouveau pour un seul meuble.</span>
      <span class="act" id="selActs"></span>
    </div>
  </div>
</div>

<script>${code}</script>
<script>
const K = globalThis.KITCHEN;

/** Everything the sidebar controls, in the shape buildScene wants. */
const ui = {
  shapeKey: "l",
  run1Cm: 360, run2Cm: 240, run3Cm: 240,
  roomLengthCm: 500, roomWidthCm: 400,
  rotationQuarters: 0,
  ilot: false, ilotLengthCm: 180, ilotWidthCm: 90, ilotRotationQuarters: 0,
  facadeHex: "#E8E4DC", worktopHex: "#2E2E30", credence: true,
  heightCm: 210, worktopHeightCm: 90,
};

/**
 * The customer's edits, kept exactly as the configure screen keeps them: the
 * scene is rebuilt from the controls every time and the edits are replayed on
 * top, so the bench exercises the same replay path the app does.
 */
let edits = null;
let signature = "";
let scene = null;
let selectedKey = null;

const sigOf = () => JSON.stringify([
  ui.shapeKey, ui.run1Cm, ui.run2Cm, ui.run3Cm, ui.ilot,
  ui.ilotLengthCm, ui.ilotWidthCm, ui.roomLengthCm, ui.roomWidthCm,
]);

function rebuild(keepEdits) {
  const next = sigOf();
  if (!keepEdits || next !== signature) { edits = null; signature = next; }
  const proposed = K.buildScene(ui);
  scene = edits ? K.applyEdits(proposed, edits) : proposed;
  push();
  paintHud();
}

function commit(nextScene) {
  scene = nextScene;
  edits = K.editsOfScene(scene);
  push();
  paintHud();
}

// ── The renderer, in an iframe ──────────────────────────────────────────────
const view = document.getElementById("view");
let ready = false;

/**
 * The renderer talks to React Native through window.ReactNativeWebView. The
 * shim below is injected ahead of it so the same messages arrive here instead,
 * which is what lets the bench react to a drag exactly as the app does.
 */
const SHIM =
  "<scr" + "ipt>" +
  "window.ReactNativeWebView={postMessage:function(s){parent.postMessage(JSON.parse(s),'*');}};" +
  // Scenes arrive by postMessage rather than the parent reaching in and calling
  // __setScene directly. A blob: iframe inside a file: page is a different
  // origin, so the direct call throws the moment the bench is opened by
  // double-clicking it — which is the only way anyone will ever open it.
  "addEventListener('message',function(e){var d=e.data;" +
  "if(d&&d.__scene&&window.__setScene)window.__setScene(d.__scene);});" +
  "</scr" + "ipt>";

function mountRenderer() {
  ready = false;
  const html = SHIM + K.RENDERER_HTML;
  const blob = new Blob([html], { type: "text/html" });
  view.src = URL.createObjectURL(blob);
}

function push() {
  if (!ready || !scene) return;
  const payload = JSON.stringify({ ...scene, editable: true, catalog: K.MODULES });
  view.contentWindow.postMessage({ __scene: payload }, "*");
}

addEventListener("message", (e) => {
  const m = e.data;
  if (!m || typeof m !== "object") return;
  if (m.type === "boot") { ready = true; push(); return; }
  if (m.type === "select") { selectedKey = m.key ?? null; paintSel(); return; }
  if (m.type === "moved") { commit(K.moveModule(scene, m.runIndex, m.key, m.offsetM)); return; }
  if (m.type === "movedRun") { commit(K.moveRun(scene, m.runIndex, m.x, m.z)); return; }
  if (m.type === "movedIlot") { commit(K.moveIlot(scene, m.x, m.z)); return; }
  if (m.type === "error") { console.error("renderer:", m.message); }
});

// ── Readouts ───────────────────────────────────────────────────────────────
function paintHud() {
  const hud = document.getElementById("hud");
  const mods = scene.runs.reduce((n, r) => n + r.modules.length, 0);
  const clash = scene.runs.some((r) => r.overlaps) || (scene.ilot && scene.ilot.overlaps);
  const euros = (K.sceneTotalCents(scene) / 100).toFixed(0);
  hud.innerHTML =
    "<span>" + scene.room.widthM.toFixed(2) + " x " + scene.room.depthM.toFixed(2) + " m</span>" +
    "<span>" + mods + " éléments</span>" +
    "<span>" + scene.runs.map((r) => Math.round(r.lengthM * 100)).join(" / ") + " cm</span>" +
    "<span>" + euros + " € atelier</span>" +
    (scene.decor && scene.decor.table ? "<span>table r=" + scene.decor.table.radiusM + "</span>" : "") +
    (clash ? "<span class='bad'>chevauchement</span>" : "");
  paintSel();
}

function paintSel() {
  const text = document.getElementById("selText");
  const acts = document.getElementById("selActs");
  acts.innerHTML = "";
  if (!selectedKey) {
    text.className = "hint";
    text.textContent = "Touchez un côté de la cuisine — puis à nouveau pour un seul meuble.";
    return;
  }
  text.className = "";
  const runIdx = K.runIndexOfKey(selectedKey);
  if (runIdx >= 0) {
    const run = scene.runs[runIdx];
    text.textContent = "Côté " + (runIdx + 1) + " · " + Math.round(run.lengthM * 100) + " cm" +
      (run.overlaps ? " · en chevauchement" : "");
    const b = document.createElement("button");
    b.textContent = "Pivoter";
    b.onclick = () => commit(K.rotateRun(scene, runIdx));
    acts.appendChild(b);
    return;
  }
  if (selectedKey === K.ILOT_KEY) { text.textContent = "Îlot central"; return; }
  let found = null, owner = -1;
  scene.runs.forEach((r, i) => r.modules.forEach((m) => { if (m.key === selectedKey) { found = m; owner = i; } }));
  if (!found) { text.textContent = selectedKey; return; }
  const mod = K.moduleById(found.moduleId);
  text.textContent = (mod ? mod.label : found.moduleId) + " · côté " + (owner + 1);
  const b = document.createElement("button");
  b.textContent = "Retirer";
  b.onclick = () => { commit(K.removeModule(scene, owner, selectedKey)); selectedKey = null; paintSel(); };
  acts.appendChild(b);
}

// ── Wiring ─────────────────────────────────────────────────────────────────
const bind = (id, key, unit) => {
  const el = document.getElementById(id);
  const out = document.getElementById(id + "o");
  const sync = () => {
    ui[key] = Number(el.value);
    if (out) out.textContent = el.value + (unit || "");
    rebuild(true);
  };
  el.addEventListener("input", sync);
  if (out) out.textContent = el.value + (unit || "");
};
bind("run1", "run1Cm", " cm"); bind("run2", "run2Cm", " cm"); bind("run3", "run3Cm", " cm");
bind("roomL", "roomLengthCm", " cm"); bind("roomW", "roomWidthCm", " cm");
bind("ilotL", "ilotLengthCm", " cm"); bind("ilotW", "ilotWidthCm", " cm");
bind("ceil", "heightCm", " cm"); bind("wtop", "worktopHeightCm", " cm");

const seg = (sel, apply) => {
  const box = document.querySelector(sel);
  box.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    [...box.querySelectorAll("button")].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    apply(b);
    rebuild(true);
  });
};
seg("#shape", (b) => { ui.shapeKey = b.dataset.k; });
seg("#side .group:nth-of-type(2) .seg:last-of-type", (b) => { ui.rotationQuarters = Number(b.dataset.q); });
seg("#side .group:nth-of-type(4) .seg", (b) => { ui.ilotRotationQuarters = Number(b.dataset.iq); });

document.getElementById("ilot").addEventListener("change", (e) => { ui.ilot = e.target.checked; rebuild(true); });
document.getElementById("credence").addEventListener("change", (e) => { ui.credence = e.target.checked; rebuild(true); });
document.getElementById("facade").addEventListener("input", (e) => { ui.facadeHex = e.target.value; rebuild(true); });
document.getElementById("worktop").addEventListener("input", (e) => { ui.worktopHex = e.target.value; rebuild(true); });

document.getElementById("reset").onclick = () => { edits = null; rebuild(false); };
document.getElementById("reload").onclick = () => mountRenderer();
document.getElementById("dump").onclick = async () => {
  const text = JSON.stringify(K.layoutOfScene(scene), null, 2);
  try { await navigator.clipboard.writeText(text); } catch (e) {}
  console.log(text);
};

mountRenderer();
rebuild(false);
</script>
</body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, PAGE);
console.log("wrote " + OUT + " (" + (Buffer.byteLength(PAGE) / 1024 / 1024).toFixed(2) + " MB)");
console.log("open with:  open " + OUT);
