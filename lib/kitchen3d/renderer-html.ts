import { THREE_BUNDLE } from "./three-bundle";

/**
 * The three.js scene, as a self-contained page driven from React Native.
 *
 * Every cabinet is generated here from its millimetre dimensions rather than
 * loaded as a model. A caisson is a box, and generating it means an 18 mm door
 * panel stays 18 mm at 400 mm wide and at 1200 mm wide — a single mesh scaled
 * to fit would fatten the panel and the poignée along with it. It also means
 * no asset pipeline, no download and no app weight.
 *
 * The page exposes `window.__setScene(json)`; the host injects a call to it on
 * load and again whenever the configuration changes.
 */
export const RENDERER_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin:0; padding:0; height:100%; overflow:hidden; background:#EFEDE9; }
  canvas { display:block; touch-action:none; }
  #err { position:absolute; inset:0; display:none; padding:24px; font:14px -apple-system,system-ui,sans-serif; color:#8A2018; background:#FBF4F3; }
</style>
</head>
<body>
<div id="err"></div>
<script>${THREE_BUNDLE}</script>
<script>
// three and OrbitControls are inlined above, so the step works with no network.
const THREE = globalThis.THREE;
const OrbitControls = globalThis.OrbitControls;

const post = (m) => { try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
window.onerror = (m) => { const e = document.getElementById('err'); e.style.display='block'; e.textContent = String(m); post({type:'error', message:String(m)}); };

// ── Constants, millimetres, mirrored from lib/kitchen3d/catalog.ts ──────────
const MM = (v) => v / 1000;
const PLINTH_H = MM(120), PLINTH_INSET = MM(50);
const WORKTOP_T = MM(40), WORKTOP_OVER = MM(20);
const PANEL_T = MM(18), GAP = MM(3);
const CREDENCE_H = MM(550);
const CORNER_CLEARANCE = MM(600);
/** Gap left between the worktop and the underside of the wall units. */
const UPSTAND = MM(550);

/**
 * Heights that follow the customer's own worktop height rather than a
 * catalogue standard. Recomputed per scene in build(): the plinth and the slab
 * keep their thickness and the carcass takes up the difference, which is what
 * a workshop actually does when it builds to a height.
 */
let WORKTOP_TOP = MM(900);
let CARCASS_H = WORKTOP_TOP - PLINTH_H - WORKTOP_T;
let WALL_BOTTOM = WORKTOP_TOP + UPSTAND;

function applyHeights(worktopTopM) {
  WORKTOP_TOP = worktopTopM > 0 ? worktopTopM : MM(900);
  // Never let a very low worktop invert the carcass.
  CARCASS_H = Math.max(MM(200), WORKTOP_TOP - PLINTH_H - WORKTOP_T);
  WALL_BOTTOM = WORKTOP_TOP + UPSTAND;
}

// ── Renderer ───────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#EFEDE9');

const camera = new THREE.PerspectiveCamera(46, window.innerWidth/window.innerHeight, 0.05, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.6;
controls.maxDistance = 16;
// Never let the camera drop below the floor or tip over the top.
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI/2 - 0.03;
controls.enablePan = false;

let root = null;      // everything that gets rebuilt on a config change
let walls = [];       // { obj, normal, centre } for camera-facing culling
let ceiling = null, ceilingY = 0;
let currentScene = null;
let currentCatalog = {};
let pickables = [];   // one tagged Group per placed module
let selectedKey = null, selectionBox = null;
let framedFor = null; // kitchen signature the camera was last framed for
let subjectPoints = []; // cabinet corners — what the shot is framed on
let ilotGroup = null;
let userMoved = false; // true once the customer has moved the camera themselves

// ── Materials ──────────────────────────────────────────────────────────────
function makeMaterials(m) {
  const std = (color, opts) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(color) }, opts||{}));
  return {
    facade:   std(m.facade,  { roughness:0.55, metalness:0.02 }),
    // The carcass reads slightly darker than the front so edges stay legible.
    carcass:  std(new THREE.Color(m.facade).multiplyScalar(0.86), { roughness:0.8 }),
    worktop:  std(m.worktop, { roughness:0.35, metalness:0.05 }),
    credence: std(new THREE.Color(m.worktop).lerp(new THREE.Color('#ffffff'), 0.12), { roughness:0.3 }),
    wall:     std(m.wall,    { roughness:0.95 }),
    floor:    std(m.floor,   { roughness:0.75 }),
    metal:    std(m.metal,   { roughness:0.32, metalness:0.85 }),
    dark:     std('#1C1D1F', { roughness:0.25, metalness:0.3 }),
    glass:    new THREE.MeshPhysicalMaterial({ color:'#BFD4DC', roughness:0.06, metalness:0, transmission:0.85, transparent:true, opacity:0.35, thickness:0.01 }),
    steel:    std('#C7CBCF', { roughness:0.28, metalness:0.9 })
  };
}

/** Box helper: size + centre, in the caller's local frame. */
function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w,0.001), Math.max(h,0.001), Math.max(d,0.001)), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ── Fittings ───────────────────────────────────────────────────────────────
/** A slim bar handle, laid horizontally unless told otherwise. */
function handle(mats, len, x, y, z, vertical) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(MM(9), MM(9), len, 12), mats.metal);
  bar.rotation.z = vertical ? 0 : Math.PI/2;
  bar.castShadow = true;
  g.add(bar);
  // Two stand-offs holding it clear of the door.
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(MM(5), MM(5), MM(22), 8), mats.metal);
    p.rotation.x = Math.PI/2;
    if (vertical) p.position.set(0, s*(len/2 - MM(30)), -MM(13));
    else p.position.set(s*(len/2 - MM(30)), 0, -MM(13));
    g.add(p);
  }
  g.position.set(x, y, z);
  return g;
}

/** A door front with its handle, sitting proud of the carcass. */
function doorFront(mats, w, h, x, y, z) {
  const g = new THREE.Group();
  g.add(box(w - GAP*2, h - GAP*2, PANEL_T, mats.facade, x, y, z));
  g.add(handle(mats, Math.min(w*0.5, MM(220)), x, y + h/2 - MM(70), z + PANEL_T/2 + MM(14), false));
  return g;
}

/** N drawer fronts stacked in the same opening, deepest at the bottom. */
function drawerFronts(mats, w, h, n, x, y, z) {
  const g = new THREE.Group();
  // A tall bottom drawer and equal ones above reads as a real cabinet.
  const weights = n === 3 ? [0.42, 0.29, 0.29] : n === 2 ? [0.55, 0.45] : [1];
  let cursor = y - h/2;
  for (let i = weights.length - 1; i >= 0; i--) {
    const fh = h * weights[i];
    const cy = cursor + fh/2;
    g.add(box(w - GAP*2, fh - GAP*2, PANEL_T, mats.facade, x, cy, z));
    g.add(handle(mats, Math.min(w*0.5, MM(220)), x, cy, z + PANEL_T/2 + MM(14), false));
    cursor += fh;
  }
  return g;
}

function sink(mats, w, x, z, depth) {
  const g = new THREE.Group();
  const bw = Math.min(w * 0.62, MM(560)), bd = depth * 0.62, wallT = MM(12), deep = MM(170);
  const top = WORKTOP_TOP;
  // Basin as four walls and a floor — a hole without needing CSG.
  g.add(box(bw, wallT, bd, mats.steel, x, top - deep, z));
  for (const s of [-1, 1]) {
    g.add(box(wallT, deep, bd, mats.steel, x + s*(bw/2), top - deep/2, z));
    g.add(box(bw, deep, wallT, mats.steel, x, top - deep/2, z + s*(bd/2)));
  }
  // Tap: a column with a curved spout.
  const col = new THREE.Mesh(new THREE.CylinderGeometry(MM(17), MM(19), MM(230), 14), mats.steel);
  col.position.set(x, top + MM(115), z - depth*0.36); col.castShadow = true; g.add(col);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, top + MM(220), z - depth*0.36),
    new THREE.Vector3(x, top + MM(300), z - depth*0.30),
    new THREE.Vector3(x, top + MM(290), z - depth*0.13),
    new THREE.Vector3(x, top + MM(240), z - depth*0.10)
  ]);
  const spout = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, MM(15), 10, false), mats.steel);
  spout.castShadow = true; g.add(spout);
  return g;
}

function hob(mats, w, x, z, depth) {
  const g = new THREE.Group();
  const pw = Math.min(w - MM(60), MM(580)), pd = depth * 0.72, top = WORKTOP_TOP;
  g.add(box(pw, MM(8), pd, mats.dark, x, top + MM(4), z));
  // Four burners.
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(MM(62), MM(5), 8, 24), mats.steel);
    r.rotation.x = Math.PI/2;
    r.position.set(x + dx*pw*0.22, top + MM(10), z + dz*pd*0.22);
    g.add(r);
  }
  return g;
}

function hood(mats, w, x, z, depth, ceilingH) {
  const g = new THREE.Group();
  // Hoods are fitted a set distance above the hob, so this follows the worktop
  // rather than sitting at a fixed height off the floor.
  const bottom = WORKTOP_TOP + MM(650);
  // Canopy, then a chimney running up to the ceiling.
  g.add(box(w*0.92, MM(120), depth*0.95, mats.steel, x, bottom + MM(60), z - depth*0.02));
  g.add(box(w*0.34, ceilingH - bottom - MM(120), depth*0.5, mats.steel, x, bottom + MM(120) + (ceilingH - bottom - MM(120))/2, z - depth*0.24));
  g.add(box(w*0.86, MM(6), depth*0.88, mats.dark, x, bottom + MM(2), z - depth*0.02));
  return g;
}

/**
 * An appliance front. The three kinds look nothing alike in a real kitchen and
 * drawing them the same way is what makes a render read as placeholder: only an
 * oven has a glass door, a fridge is a plain steel slab, and an integrated
 * lave-vaisselle is a façade panel with a control strip along its top edge.
 */
function appliancePanel(mats, w, h, x, y, z, kind) {
  const g = new THREE.Group();
  const body = kind === 'dishwasher' ? mats.facade : mats.steel;
  g.add(box(w - GAP*2, h - GAP*2, PANEL_T, body, x, y, z));

  if (kind === 'oven') {
    g.add(box(w*0.66, h*0.5, MM(6), mats.dark, x, y - h*0.04, z + PANEL_T/2 + MM(2)));
    g.add(handle(mats, w*0.78, x, y + h/2 - MM(55), z + PANEL_T/2 + MM(16), false));
  } else if (kind === 'dishwasher') {
    g.add(box(w - GAP*2, MM(45), MM(5), mats.steel, x, y + h/2 - MM(40), z + PANEL_T/2 + MM(2)));
    g.add(handle(mats, w*0.78, x, y + h/2 - MM(110), z + PANEL_T/2 + MM(16), false));
  }
  return g;
}

// ── Cabinet builders ───────────────────────────────────────────────────────
function baseUnit(mats, mod, ox, ceilingH) {
  const g = new THREE.Group();
  const w = MM(mod.widthMm), d = MM(mod.depthMm);
  const x = ox + w/2, carcassD = d - PANEL_T;

  g.add(box(w, PLINTH_H, carcassD - PLINTH_INSET, mats.dark, x, PLINTH_H/2, (carcassD - PLINTH_INSET)/2));
  g.add(box(w, CARCASS_H, carcassD, mats.carcass, x, PLINTH_H + CARCASS_H/2, carcassD/2));

  const fy = PLINTH_H + CARCASS_H/2, fz = carcassD + PANEL_T/2;
  if (mod.fixture === 'dishwasher') g.add(appliancePanel(mats, w, CARCASS_H, x, fy, fz, 'dishwasher'));
  else if (mod.drawers) g.add(drawerFronts(mats, w, CARCASS_H, mod.drawers, x, fy, fz));
  else if (mod.widthMm > 700) {
    // Wide cabinets take a pair of doors rather than one unliftable slab.
    g.add(doorFront(mats, w/2, CARCASS_H, x - w/4, fy, fz));
    g.add(doorFront(mats, w/2, CARCASS_H, x + w/4, fy, fz));
  } else g.add(doorFront(mats, w, CARCASS_H, x, fy, fz));

  if (mod.fixture === 'sink') g.add(sink(mats, w, x, d/2, d));
  if (mod.fixture === 'hob') g.add(hob(mats, w, x, d/2, d));
  return g;
}

function wallUnit(mats, mod, ox, ceilingH) {
  const g = new THREE.Group();
  const w = MM(mod.widthMm), d = MM(mod.depthMm), h = MM(mod.heightMm);
  const x = ox + w/2;
  if (mod.fixture === 'hood') { g.add(hood(mats, w, x, d/2, d, ceilingH)); return g; }

  const carcassD = d - PANEL_T;
  g.add(box(w, h, carcassD, mats.carcass, x, WALL_BOTTOM + h/2, carcassD/2));
  const fz = carcassD + PANEL_T/2;
  if (mod.widthMm > 700) {
    g.add(doorFront(mats, w/2, h, x - w/4, WALL_BOTTOM + h/2, fz));
    g.add(doorFront(mats, w/2, h, x + w/4, WALL_BOTTOM + h/2, fz));
  } else g.add(doorFront(mats, w, h, x, WALL_BOTTOM + h/2, fz));
  return g;
}

function column(mats, mod, ox) {
  const g = new THREE.Group();
  const w = MM(mod.widthMm), d = MM(mod.depthMm), h = MM(mod.heightMm);
  const x = ox + w/2, carcassD = d - PANEL_T, fz = carcassD + PANEL_T/2;

  g.add(box(w, PLINTH_H, carcassD - PLINTH_INSET, mats.dark, x, PLINTH_H/2, (carcassD - PLINTH_INSET)/2));
  g.add(box(w, h - PLINTH_H, carcassD, mats.carcass, x, PLINTH_H + (h - PLINTH_H)/2, carcassD/2));

  const top = h, bottom = PLINTH_H;
  if (mod.fixture === 'fridge') {
    // Two doors, the freezer taking the lower third.
    const split = bottom + (top - bottom) * 0.34;
    g.add(appliancePanel(mats, w, split - bottom, x, (bottom + split)/2, fz, 'fridge'));
    g.add(appliancePanel(mats, w, top - split, x, (split + top)/2, fz, 'fridge'));
    for (const yy of [split - MM(120), split + MM(120)])
      g.add(handle(mats, MM(200), x + w/2 - MM(70), yy, fz + PANEL_T/2 + MM(14), true));
  } else if (mod.fixture === 'oven' || mod.fixture === 'microwave') {
    // Stacked downwards from the top of the column rather than pinned to a
    // fixed height off the floor: a colonne four puts the oven at eye level,
    // and a customer who orders a 110 cm worktop must not end up with a
    // micro-ondes poking through the top of the carcass.
    const ovenH = MM(595), moH = MM(455), topDoorH = MM(300);
    let cursor = top - topDoorH;
    g.add(doorFront(mats, w, topDoorH, x, top - topDoorH/2, fz));
    if (mod.fixture === 'microwave') {
      g.add(appliancePanel(mats, w, moH, x, cursor - moH/2, fz, 'oven'));
      cursor -= moH;
    }
    g.add(appliancePanel(mats, w, ovenH, x, cursor - ovenH/2, fz, 'oven'));
    cursor -= ovenH;
    if (cursor > bottom) g.add(doorFront(mats, w, cursor - bottom, x, (bottom + cursor)/2, fz));
  } else {
    // Plain storage: a tall door and a short one above.
    const split = bottom + (top - bottom) * 0.68;
    g.add(doorFront(mats, w, split - bottom, x, (bottom + split)/2, fz));
    g.add(doorFront(mats, w, top - split, x, (split + top)/2, fz));
  }
  return g;
}

// ── Worktop and crédence, derived from the base units ───────────────────────
/**
 * Worktops run over contiguous stretches of base unit and stop at a column,
 * which is what happens in a fitted kitchen — one slab through a fridge
 * column would give the whole thing away.
 */
function worktopSpans(mats, placed, catalog, group, runLength, withCredence) {
  let start = null, end = null, depth = MM(600);
  const flush = () => {
    if (start == null) return;
    const w = end - start;
    group.add(box(w, WORKTOP_T, depth + WORKTOP_OVER, mats.worktop,
      start + w/2, WORKTOP_TOP - WORKTOP_T/2, (depth + WORKTOP_OVER)/2));
    // The customer can decline the crédence, and then there simply is not one.
    if (withCredence) {
      group.add(box(w, CREDENCE_H, MM(14), mats.credence,
        start + w/2, WORKTOP_TOP + CREDENCE_H/2, MM(7)));
    }
    start = null;
  };
  const sorted = placed.slice().sort((a,b) => a.offsetM - b.offsetM);
  for (const p of sorted) {
    const mod = catalog[p.moduleId];
    if (!mod || mod.slot !== 'bas') { flush(); continue; }
    const w = MM(mod.widthMm);
    if (start == null) { start = p.offsetM; depth = MM(mod.depthMm); }
    else if (Math.abs(p.offsetM - end) > 0.02) { flush(); start = p.offsetM; depth = MM(mod.depthMm); }
    end = p.offsetM + w;
  }
  flush();
}

// ── Room shell, with holes cut for doors and windows ────────────────────────
/** A wall built as segments around its openings — exact, and no CSG needed. */
function buildWall(mats, width, height, openings, thickness) {
  const g = new THREE.Group();
  const ops = openings.slice().sort((a,b) => a.offsetM - b.offsetM);
  let cursor = 0;
  for (const o of ops) {
    const l = Math.max(0, Math.min(o.offsetM, width));
    const r = Math.max(l, Math.min(o.offsetM + o.widthM, width));
    if (l > cursor) g.add(box(l - cursor, height, thickness, mats.wall, cursor + (l - cursor)/2, height/2, 0));
    if (o.sillM > 0) g.add(box(r - l, o.sillM, thickness, mats.wall, l + (r - l)/2, o.sillM/2, 0));
    const topY = o.sillM + o.heightM;
    if (topY < height) g.add(box(r - l, height - topY, thickness, mats.wall, l + (r - l)/2, topY + (height - topY)/2, 0));
    if (o.kind === 'window') {
      g.add(box(r - l, o.heightM, MM(8), mats.glass, l + (r - l)/2, o.sillM + o.heightM/2, 0));
      // A frame and one mullion, so it reads as a window and not a hole.
      const fT = MM(45);
      g.add(box(r - l, fT, thickness*1.2, mats.wall, l + (r-l)/2, o.sillM + fT/2, 0));
      g.add(box(r - l, fT, thickness*1.2, mats.wall, l + (r-l)/2, topY - fT/2, 0));
      g.add(box(fT, o.heightM, thickness*1.2, mats.wall, l + (r-l)/2, o.sillM + o.heightM/2, 0));
    }
    cursor = r;
  }
  if (cursor < width) g.add(box(width - cursor, height, thickness, mats.wall, cursor + (width - cursor)/2, height/2, 0));
  g.traverse((c) => { if (c.isMesh) { c.receiveShadow = true; c.castShadow = false; } });
  return g;
}

// ── Scene assembly ─────────────────────────────────────────────────────────
function build(data, catalog) {
  if (root) { scene.remove(root); root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } }); }
  root = new THREE.Group();
  walls = [];
  pickables = [];
  ilotGroup = null;
  selectionBox = null;

  applyHeights((data.geometry && data.geometry.worktopTopM) || MM(900));
  const mats = makeMaterials(data.materials);
  const W = data.room.widthM, D = data.room.depthM, H = data.room.heightM;
  const T = MM(100);

  // Floor and ceiling.
  const floor = box(W, MM(20), D, mats.floor, 0, -MM(10), 0);
  floor.castShadow = false; root.add(floor);
  ceiling = box(W, MM(20), D, mats.wall, 0, H + MM(10), 0);
  ceiling.castShadow = false; ceilingY = H; root.add(ceiling);

  // Four walls, each with its own openings. Kept in the walls list so the
  // render loop can drop whichever stands between the camera and the kitchen.
  const opsOn = (w) => (data.openings || []).filter((o) => o.wall === w);
  const defs = [
    { wall:'back',  width:W, pos:[0, 0, -D/2 - T/2], rotY:0,            normal:[0,0,1],  map:(o)=>o.offsetM },
    { wall:'front', width:W, pos:[0, 0,  D/2 + T/2], rotY:Math.PI,      normal:[0,0,-1], map:(o)=>W - o.offsetM - o.widthM },
    { wall:'left',  width:D, pos:[-W/2 - T/2, 0, 0], rotY:Math.PI/2,    normal:[1,0,0],  map:(o)=>D - o.offsetM - o.widthM },
    { wall:'right', width:D, pos:[ W/2 + T/2, 0, 0], rotY:-Math.PI/2,   normal:[-1,0,0], map:(o)=>o.offsetM }
  ];
  for (const d of defs) {
    const ops = opsOn(d.wall).map((o) => Object.assign({}, o, { offsetM: d.map(o) }));
    const g = buildWall(mats, d.width, H, ops, T);
    // Segments are built from 0..width; recentre on the wall.
    g.position.set(-d.width/2, 0, 0);
    const holder = new THREE.Group();
    holder.add(g);
    holder.position.set(d.pos[0], d.pos[1], d.pos[2]);
    holder.rotation.y = d.rotY;
    root.add(holder);
    walls.push({ obj: holder, normal: new THREE.Vector3(d.normal[0], d.normal[1], d.normal[2]), centre: new THREE.Vector3(d.pos[0], H/2, d.pos[2]) });
  }

  // Runs. A return run has to face into the room, which fixes its direction:
  // the left one is laid front-to-back, the right one back-to-front.
  /**
   * Where a run starts, given the room it is in.
   *
   * A return run is anchored at the corner it turns out of, not stretched to
   * fill its wall — the room can be deeper than the run is long, and a kitchen
   * that floated away from its own corner when the room grew would be wrong.
   * The left one is laid front-to-back so its cabinets face into the room, so
   * its *start* is the far end and the corner is where it finishes.
   */
  const placementFor = (run) => {
    if (run.wall === 'back') return { pos: [-W/2, 0, -D/2], rotY: 0 };
    if (run.wall === 'left') {
      return { pos: [-W/2, 0, -D/2 + CORNER_CLEARANCE + run.lengthM], rotY: Math.PI/2 };
    }
    if (run.wall === 'right') {
      return { pos: [W/2, 0, -D/2 + CORNER_CLEARANCE], rotY: -Math.PI/2 };
    }
    return null;
  };

  data.runs.forEach((run, runIndex) => {
    const p = placementFor(run);
    if (!p) return;
    const g = new THREE.Group();
    g.position.set(p.pos[0], p.pos[1], p.pos[2]);
    g.rotation.y = p.rotY;

    for (const item of run.modules) {
      const mod = catalog[item.moduleId];
      if (!mod) continue;
      let mg;
      if (mod.slot === 'bas') mg = baseUnit(mats, mod, item.offsetM, H);
      else if (mod.slot === 'haut') mg = wallUnit(mats, mod, item.offsetM, H);
      else mg = column(mats, mod, item.offsetM);
      // The meshes inside sit at their authored offset, so the group itself
      // stays at the origin and its position.x is used purely as a live drag
      // delta. That keeps the builders free of any drag concern.
      mg.userData = {
        key: item.key, runIndex, moduleId: mod.id, slot: mod.slot,
        offsetM: item.offsetM, widthM: MM(mod.widthMm), runGroup: g,
      };
      g.add(mg);
      pickables.push(mg);
    }
    worktopSpans(mats, run.modules, catalog, g, run.lengthM, data.geometry.credence !== false);
    root.add(g);
  });

  // Island: a run of cabinets back to back under one slab.
  if (data.ilot) {
    const g = new THREE.Group();
    const iw = data.ilot.widthM, idp = data.ilot.depthM;
    // The island carries its own worktop height — a breakfast bar is commonly
    // ordered higher than the runs — so its carcass is sized separately.
    const iTop = data.ilot.topM > 0 ? data.ilot.topM : WORKTOP_TOP;
    const iCarcass = Math.max(MM(200), iTop - PLINTH_H - WORKTOP_T);
    g.position.set(data.ilot.x - iw/2, 0, data.ilot.z - idp/2);
    const carcassD = idp - PANEL_T*2;
    g.add(box(iw, PLINTH_H, carcassD - PLINTH_INSET, mats.dark, iw/2, PLINTH_H/2, idp/2));
    g.add(box(iw, iCarcass, carcassD, mats.carcass, iw/2, PLINTH_H + iCarcass/2, idp/2));
    const n = Math.max(2, Math.round(iw / 0.6));
    for (let i = 0; i < n; i++) {
      const dw = iw/n;
      g.add(drawerFronts(mats, dw, iCarcass, 3, dw*i + dw/2, PLINTH_H + iCarcass/2, idp/2 + carcassD/2 + PANEL_T/2));
    }
    g.add(box(iw + MM(60), WORKTOP_T, idp + MM(60), mats.worktop, iw/2, iTop - WORKTOP_T/2, idp/2));
    // The island belongs to no run, so it moves across the floor rather than
    // along a line — tagged here so the drag handler can tell the two apart.
    g.userData = { key: '__ilot', isIlot: true, x: data.ilot.x, z: data.ilot.z };
    ilotGroup = g;
    pickables.push(g);
    root.add(g);
  }

  // What the shot is framed on: the corners of every cabinet, not the room.
  // Falls back to the room when nothing was placed, so an empty kitchen still
  // shows something.
  subjectPoints = [];
  // Box3.setFromObject only refreshes an object's descendants, never its
  // ancestors, and root is not in the scene yet — so without this the rotated
  // return runs get measured as if they were still unrotated at the origin,
  // and the shot ends up framed on a kitchen that is not there.
  root.updateMatrixWorld(true);
  const collect = (obj) => {
    const b = new THREE.Box3().setFromObject(obj);
    if (b.isEmpty()) return;
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) subjectPoints.push(new THREE.Vector3(x, y, z));
  };
  for (const p of pickables) collect(p);
  if (ilotGroup) collect(ilotGroup);
  if (!subjectPoints.length) {
    for (const x of [-W/2, W/2])
      for (const y of [0, H])
        for (const z of [-D/2, D/2]) subjectPoints.push(new THREE.Vector3(x, y, z));
  }

  scene.add(root);
  highlight();
  // Only reframe when the kitchen itself changed. Re-injecting after an edit
  // must not throw the camera back to its opening shot.
  const shape = W + 'x' + D + 'x' + H + 'x' + pickables.length;
  if (shape !== framedFor) { framedFor = shape; userMoved = false; fitTo(FACE_DIR); }
  post({ type:'ready' });
}

// ── Lighting ───────────────────────────────────────────────────────────────
function setupLights(W, D, H) {
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#C9BCA8', 1.8));
  // Kept deliberately soft: one hard key makes a generated kitchen look like a
  // render, and the shadow terminator lands right where the door gaps are.
  const key = new THREE.DirectionalLight('#FFF6E8', 1.5);
  key.position.set(W*0.7, H*2.1, D*1.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 40;
  const s = Math.max(W, D) * 1.2;
  key.shadow.camera.left = -s; key.shadow.camera.right = s;
  key.shadow.camera.top = s;  key.shadow.camera.bottom = -s;
  key.shadow.bias = -0.0008;
  key.shadow.radius = 3;
  scene.add(key);
  // Bounce off the missing fourth wall, so fronts never go flat black.
  const fill = new THREE.DirectionalLight('#DCE6F0', 0.8);
  fill.position.set(-W, H, D*2);
  scene.add(fill);
  scene.add(new THREE.AmbientLight('#FFFFFF', 0.55));
}

/**
 * How much of the frame the kitchen fills. 1.0 is a tight fit to its bounding
 * box; above that leaves air around it.
 */
const FILL = 1.02;

/** The opening angle, as an offset from the subject's centre. */
const FACE_DIR = [0.34, 0.44, 0.83];

/**
 * Frames the camera on the cabinets rather than on the room.
 *
 * Two things were wrong with sizing the shot from the room's dimensions alone.
 * It ignored the canvas shape, so the same kitchen was cut off on a narrow
 * viewport and lost in the middle of a wide one — the distance came out the
 * same 4.2 m either way. And it framed the *room*, so a small kitchen in a
 * generous room was pushed away by the empty floor around it.
 *
 * Fitting the subject's bounding box against both field-of-view axes makes a
 * 3 × 2 m kitchen fill the frame exactly as much as a 5 × 4 m one, on any
 * screen. The metre stays a metre — only the camera moves.
 */
function fitTo(dirArray) {
  if (!subjectPoints.length) return;

  const dir = new THREE.Vector3(dirArray[0], dirArray[1], dirArray[2]).normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(dir, worldUp).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();

  /**
   * Measured on the screen plane, from the cabinets' own corners.
   *
   * Fitting one bounding box around the whole kitchen is what made an L look
   * lost: its box contains the empty corner the L wraps around, so a third of
   * the frame was spent on floor nobody asked to see. Projecting every
   * cabinet's corners and taking the extent of *those* both tightens the shot
   * and re-centres it on the furniture rather than on the room.
   */
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of subjectPoints) {
    const sx = p.dot(right), sy = p.dot(up), sz = p.dot(dir);
    if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    if (sz < minZ) minZ = sz; if (sz > maxZ) maxZ = sz;
  }

  const halfW = (maxX - minX) / 2, halfH = (maxY - minY) / 2;
  const centre = new THREE.Vector3()
    .addScaledVector(right, (minX + maxX) / 2)
    .addScaledVector(up, (minY + maxY) / 2)
    .addScaledVector(dir, (minZ + maxZ) / 2);

  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  // The nearest cabinet is what has to clear the frustum, so the subject's own
  // depth is added on top of the distance that fits its silhouette.
  const dist =
    Math.max(halfH / Math.tan(vFov / 2), halfW / Math.tan(hFov / 2)) * FILL +
    (maxZ - minZ) / 2;

  camera.position.copy(centre).addScaledVector(dir, dist);
  controls.target.copy(centre);
  controls.minDistance = Math.max(0.5, dist * 0.22);
  controls.maxDistance = dist * 2.6;
  controls.update();
}

// ── Host bridge ────────────────────────────────────────────────────────────
let lit = false;
window.__setScene = function (payload) {
  try {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    currentScene = data;
    currentCatalog = {};
    for (const m of data.catalog) currentCatalog[m.id] = m;
    // A module that no longer exists must not keep a stale outline around it.
    if (selectedKey && !data.runs.some((r) => r.modules.some((m) => m.key === selectedKey))) {
      selectedKey = null;
      post({ type: 'select', key: null });
    }
    if (!lit) { setupLights(data.room.widthM, data.room.depthM, data.room.heightM); lit = true; }
    build(data, currentCatalog);
  } catch (e) { window.onerror(e && e.message ? e.message : String(e)); }
};

/**
 * Dolly the camera towards or away from what it is looking at.
 *
 * Eased over a few frames rather than jumped, and clamped to the same limits
 * the pinch gesture obeys, so tapping the button and pinching cannot end up in
 * different places. A drag cancels it — the finger always wins.
 */
let zoomTo = null;
window.__zoom = function (factor) {
  if (!currentScene) return;
  // Compound onto the pending target, not onto where the camera happens to be
  // right now: tapping + five times quickly should travel five steps, and
  // measuring the in-flight position would make four of them cancel out.
  const from = zoomTo != null ? zoomTo : camera.position.distanceTo(controls.target);
  zoomTo = Math.min(
    controls.maxDistance,
    Math.max(controls.minDistance, from * factor),
  );
};

// ── Selection and dragging ─────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const hitPoint = new THREE.Vector3();
let drag = null;

function toNdc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointerNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

/** The tagged module group under the pointer, if any. */
function pickAt(e) {
  toNdc(e);
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(pickables, true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !(o.userData && o.userData.key)) o = o.parent;
  return o ? { group: o, point: hits[0].point } : null;
}

function highlight() {
  if (selectionBox) { root.remove(selectionBox); selectionBox = null; }
  const g = pickables.find((p) => p.userData.key === selectedKey);
  if (!g) return;
  selectionBox = new THREE.BoxHelper(g, new THREE.Color('#1B6EF3'));
  selectionBox.material.depthTest = false;
  selectionBox.material.linewidth = 2;
  root.add(selectionBox);
}

function select(key) {
  if (selectedKey === key) return;
  selectedKey = key;
  highlight();
  post({ type: 'select', key });
}

/**
 * How far the module may slide, given its neighbours on the same strip.
 *
 * Duplicates the rule in lib/kitchen3d/edit.ts on purpose: this one only has to
 * keep the drag looking right under the finger. What gets posted back on
 * release is re-clamped there before anything believes it.
 */
function dragBounds(group) {
  const { runIndex, key, slot, widthM } = group.userData;
  const run = currentScene.runs[runIndex];
  const band = (s) => (s === 'haut' ? 'wall' : 'floor');
  const mine = band(slot);
  let min = 0, max = run.lengthM - widthM;
  for (const other of run.modules) {
    if (other.key === key) continue;
    const mod = currentCatalog[other.moduleId];
    if (!mod || band(mod.slot) !== mine) continue;
    const start = other.offsetM, end = start + MM(mod.widthMm);
    if (end <= group.userData.offsetM + 1e-6) min = Math.max(min, end);
    else if (start >= group.userData.offsetM + widthM - 1e-6) max = Math.min(max, start - widthM);
  }
  return { min, max: Math.max(min, max) };
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  // A touch always beats an in-flight button zoom, and means the camera is the
  // customer's from now on — a resize must not snatch it back.
  zoomTo = null;
  userMoved = true;
  if (!currentScene || !currentScene.editable) return;
  const hit = pickAt(e);
  select(hit ? hit.group.userData.key : null);
  if (!hit) return;

  // Slide on a horizontal plane through the grab point, so the module tracks
  // the finger at the height it was grabbed rather than at the floor.
  dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hit.point);

  if (hit.group.userData.isIlot) {
    drag = {
      group: hit.group,
      ilot: true,
      startPoint: hit.point.clone(),
      startX: hit.group.userData.x,
      startZ: hit.group.userData.z,
      moved: false,
    };
  } else {
    const local = hit.group.userData.runGroup.worldToLocal(hit.point.clone());
    drag = {
      group: hit.group,
      startLocalX: local.x,
      startOffset: hit.group.userData.offsetM,
      bounds: dragBounds(hit.group),
      moved: false,
    };
  }
  controls.enabled = false;
  renderer.domElement.setPointerCapture(e.pointerId);
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag) return;
  toNdc(e);
  raycaster.setFromCamera(pointerNdc, camera);
  if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return;

  if (drag.ilot) {
    // Two axes instead of one; the host re-clamps to the free floor on release.
    const dx = hitPoint.x - drag.startPoint.x;
    const dz = hitPoint.z - drag.startPoint.z;
    if (Math.abs(dx) > 0.002 || Math.abs(dz) > 0.002) drag.moved = true;
    drag.group.position.x = drag.group.userData.x - currentScene.ilot.widthM/2 + dx;
    drag.group.position.z = drag.group.userData.z - currentScene.ilot.depthM/2 + dz;
    drag.lastX = drag.startX + dx;
    drag.lastZ = drag.startZ + dz;
    if (selectionBox) selectionBox.update();
    return;
  }

  const local = drag.group.userData.runGroup.worldToLocal(hitPoint.clone());
  const wanted = drag.startOffset + (local.x - drag.startLocalX);
  const clamped = Math.min(Math.max(wanted, drag.bounds.min), drag.bounds.max);
  if (Math.abs(clamped - drag.startOffset) > 0.002) drag.moved = true;
  drag.group.position.x = clamped - drag.startOffset;
  if (selectionBox) selectionBox.update();
});

function endDrag(e) {
  if (!drag) return;
  const g = drag.group;
  const wasIlot = drag.ilot;
  const offsetM = g.userData.offsetM + g.position.x;
  const lastX = drag.lastX, lastZ = drag.lastZ;
  const moved = drag.moved;
  drag = null;
  controls.enabled = true;
  try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) {}
  if (!moved) return;
  if (wasIlot) post({ type: 'movedIlot', x: lastX, z: lastZ });
  else post({ type: 'moved', key: g.userData.key, runIndex: g.userData.runIndex, offsetM });
}
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);

/** Lets the host clear or move the selection without a round trip through a tap. */
window.__setSelection = function (key) {
  selectedKey = key;
  highlight();
};

addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // The fit depends on the aspect, so a rotation or a split-screen resize has
  // to reframe — unless the customer has already chosen their own angle.
  if (!userMoved) fitTo(FACE_DIR);
});

const tmp = new THREE.Vector3();
function tick() {
  requestAnimationFrame(tick);
  // Drop any wall standing between the camera and the room, so the kitchen is
  // always visible from outside — the doll's-house view every planner uses.
  for (const w of walls) {
    // Keep a wall only while the camera is on its inward side; the one the
    // camera stands behind is the one in the way.
    tmp.copy(camera.position).sub(w.centre);
    w.obj.visible = tmp.dot(w.normal) > 0;
  }
  // Same for the ceiling once the camera climbs above it.
  if (ceiling) ceiling.visible = camera.position.y < ceilingY;

  if (zoomTo != null) {
    const offset = camera.position.clone().sub(controls.target);
    const len = offset.length();
    const next = len + (zoomTo - len) * 0.2;
    camera.position.copy(controls.target).add(offset.multiplyScalar(next / len));
    if (Math.abs(next - zoomTo) < 0.004) zoomTo = null;
  }
  controls.update();
  renderer.render(scene, camera);
}
tick();
post({ type:'boot' });
</script>
</body>
</html>`;
