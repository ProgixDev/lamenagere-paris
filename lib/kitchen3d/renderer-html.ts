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
const RoundedBoxGeometry = globalThis.RoundedBoxGeometry;

const post = (m) => { try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
window.onerror = (m) => { const e = document.getElementById('err'); e.style.display='block'; e.textContent = String(m); post({type:'error', message:String(m)}); };

// ── Constants, millimetres, mirrored from lib/kitchen3d/catalog.ts ──────────
const MM = (v) => v / 1000;
const PLINTH_H = MM(120), PLINTH_INSET = MM(50);
const WORKTOP_T = MM(40), WORKTOP_OVER = MM(20);
const PANEL_T = MM(18), GAP = MM(3);
const CREDENCE_H = MM(550);
const CORNER_CLEARANCE = MM(600);
/** Carcass depth of a run, mirrored from RUN_DEPTH_M in types.ts. */
const RUN_DEPTH = MM(600);
/** Selection key prefix for a whole run, mirrored from edit.ts. */
const RUN_KEY = '__run';
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
// Under 1.0 on purpose: the floor and the pale façades were clipping to white
// at the top end, which takes the grain and the door edges with them.
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

/**
 * A soft vertical wash instead of one flat colour.
 *
 * Two walls are culled at any time, so a good deal of the frame is backdrop.
 * A single fill reads as a cut-out and flattens the whole shot; a gradient
 * gives the room somewhere to sit and costs one 2x256 texture.
 */
function backdropTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#E4E0D8');
  grad.addColorStop(0.55, '#EFEDE9');
  grad.addColorStop(1, '#F6F4F0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
scene.background = backdropTexture();
// A handle for the test harness, so a probe can isolate one variable in a live
// page instead of a change being tuned blind. See "Isolate before tuning".
window.__scene = scene;

/**
 * Reflections, from a room generated in code.
 *
 * A MeshStandardMaterial with any metalness and no environment to reflect is
 * lit only by the lamps, so chrome renders as flat grey and a polished worktop
 * looks like matte paper. RoomEnvironment builds a plausible interior out of
 * boxes and PMREM turns it into the blurred probe the shader samples — the
 * single biggest gain available here, and it downloads nothing.
 */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
// Dialled well down. At full strength the probe is bright enough to lay a
// vertical gradient across every door, which reads as wet lacquer rather than
// painted wood — the reflection is wanted for the stone and the metal, not for
// the cabinetry.
// Enough to light faces the key never reaches. A strong directional lamp with
// little ambient blasts the cabinet ends while the doors face away from it —
// invisible on white, but on a saturated mid-tone the two read as different
// materials. The probe lights every orientation, so it carries more of the load.
/**
 * Turned up for the gloss.
 *
 * Nudged up from 0.42 for the gloss, and no further.
 *
 * The temptation is to crank it: brillance looks like brightness. But this
 * scales the *diffuse* irradiance as well as the specular, so at 0.95 the room
 * washes to white, the doors lose their shading and the gloss disappears into
 * the glare. What sells a lacquered front is a sharp highlight against a
 * surface that is still shaded — the clear coat's roughness does that work,
 * not the strength of the probe.
 */
scene.environmentIntensity = 0.5;

// ── Procedural surfaces ────────────────────────────────────────────────────
/**
 * Textures drawn at run time rather than downloaded.
 *
 * The point is not to save a download — it is that a photographed oak plank is
 * stuck being oak, whereas a drawn one takes the customer's own colour and
 * keeps its grain. Everything here is tinted from the hex they picked.
 */
function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getStyle();

/** Boards with a grain, for the floor. */
function woodTexture(hex) {
  return canvasTexture(512, 512, (g) => {
    const N = 512;
    g.fillStyle = hex; g.fillRect(0, 0, N, N);
    const boards = 4, bh = N / boards;
    for (let b = 0; b < boards; b++) {
      // Each board sits a shade off its neighbours, as real ones do.
      g.fillStyle = shade(hex, 0.90 + ((b * 37) % 11) / 55);
      g.fillRect(0, b * bh, N, bh - 2);
      // Grain: long, shallow arcs along the board.
      for (let i = 0; i < 30; i++) {
        const y = b * bh + 4 + Math.random() * (bh - 8);
        g.strokeStyle = shade(hex, 0.76 + Math.random() * 0.3);
        g.globalAlpha = 0.5;
        g.lineWidth = 0.5 + Math.random() * 1.5;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(170, y + (Math.random() - 0.5) * 7, 340, y + (Math.random() - 0.5) * 7, N, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      // The joint between boards: a dark line with a lit chamfer under it, so
      // the floor reads as laid planks rather than a printed pattern.
      const jy = b * bh + bh - 1;
      g.strokeStyle = shade(hex, 0.5); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0, jy); g.lineTo(N, jy); g.stroke();
      g.strokeStyle = shade(hex, 1.14); g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, jy + 1.6); g.lineTo(N, jy + 1.6); g.stroke();
    }
  }, [3, 3]);
}

/**
 * Marble, for a worktop or a slab crédence.
 *
 * The earlier version drew straight polylines over uniform speckle, which from
 * a metre away averaged out to a flat fill — the stone was the one surface a
 * customer looks at and it read as painted card. Real marble has three things
 * this now draws: broad cloudy patches, veins that curve and taper, and a pale
 * halo along each vein where the crystal is coarser. Bezier segments give the
 * curve; drawing each vein twice, wide and soft then narrow and bright, gives
 * the halo.
 */
function stoneTexture(hex) {
  return canvasTexture(1024, 1024, (g) => {
    const N = 1024;
    g.fillStyle = hex; g.fillRect(0, 0, N, N);

    // Cloudy patches, so the ground is not one even tone. Kept faint: at full
    // strength they read as tie-dye and swamp the veins that carry the stone.
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * N, y = Math.random() * N;
      const r = 90 + Math.random() * 240;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, shade(hex, 0.9 + Math.random() * 0.2));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.globalAlpha = 0.24;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;

    // Fine crystal speckle, kept subtle — it is grain, not noise.
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = shade(hex, 0.86 + Math.random() * 0.3);
      g.globalAlpha = 0.5;
      g.fillRect(Math.random() * N, Math.random() * N, 1.3, 1.3);
    }
    g.globalAlpha = 1;

    // One heading for the whole slab: bedding planes run together, and veins
    // pointing every which way read as cracks rather than stone.
    const HEADING = -0.55 + Math.random() * 0.5;

    /** One vein, walked as tapering bezier segments across the tile. */
    const vein = (width, bright, alpha) => {
      let x = Math.random() * N, y = Math.random() * N;
      // A shared heading per vein, so the whole family runs one way as bedding
      // planes do, rather than scribbling in every direction.
      let a = HEADING + (Math.random() - 0.5) * 0.9;
      g.strokeStyle = shade(hex, bright);
      g.globalAlpha = alpha;
      g.lineCap = 'round';
      for (let k = 0; k < 9; k++) {
        const len = 70 + Math.random() * 150;
        const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
        const bend = (Math.random() - 0.5) * 90;
        g.lineWidth = Math.max(0.4, width * (1 - k / 12) * (0.6 + Math.random() * 0.8));
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo((x + nx) / 2 - Math.sin(a) * bend, (y + ny) / 2 + Math.cos(a) * bend, nx, ny);
        g.stroke();
        x = nx; y = ny;
        a += (Math.random() - 0.5) * 0.55;
      }
      g.globalAlpha = 1;
    };

    // Halo pass: wide and soft. Then the vein itself: narrow and bright.
    for (let v = 0; v < 5; v++) vein(13, 1.22, 0.20);
    for (let v = 0; v < 5; v++) vein(3.4, 1.65, 0.62);
    // A scatter of hairlines threading between them.
    for (let v = 0; v < 9; v++) vein(1.1, 1.4, 0.34);
  }, [2, 2]);
}

/**
 * The soft dark pool a piece of furniture sits in.
 *
 * A directional lamp cannot produce this: the gap under a plinth is dark
 * because almost no light reaches it from anywhere, which is ambient occlusion,
 * and there is no AO pass here. Without it every cabinet hovers a millimetre
 * off the floor however the lights are aimed — the single clearest tell that a
 * render was generated. One blurred quad per run costs nothing and fixes it.
 *
 * Built without ctx.filter: Safari only gained canvas filters recently and the
 * WebView this runs in is not always the newest. A vertical gradient faded at
 * both ends by a destination-in pass gives the same soft blob anywhere.
 */
const shadowTexture = (() => {
  const cache = {};
  return (kind) => {
    if (cache[kind]) return cache[kind];
    const N = 256;
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const g = c.getContext('2d');

    /**
     * Both variants hold their darkness across the part the furniture covers
     * and only fall away outside it. The whole point of the quad is the pool
     * that spills past the plinth — put the falloff under the cabinet and the
     * only thing on show is the transparent tail, which is to say nothing.
     */
    if (kind === 'pool') {
      // An island is approached from every side, so its shadow closes all
      // round rather than running off one edge.
      const r = g.createRadialGradient(N/2, N/2, N*0.1, N/2, N/2, N*0.5);
      r.addColorStop(0, 'rgba(0,0,0,0.46)');
      r.addColorStop(0.5, 'rgba(0,0,0,0.40)');
      r.addColorStop(0.76, 'rgba(0,0,0,0.20)');
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, N, N);
    } else {
      // Dark from the wall out to the front of the plinth, then away: light
      // reaches under the front edge of a cabinet and never the back of one.
      const v = g.createLinearGradient(0, 0, 0, N);
      v.addColorStop(0, 'rgba(0,0,0,0.5)');
      v.addColorStop(0.58, 'rgba(0,0,0,0.44)');
      v.addColorStop(0.78, 'rgba(0,0,0,0.16)');
      v.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = v;
      g.fillRect(0, 0, N, N);

      // Taper the two ends so a run's shadow does not stop dead at its corner.
      // Narrow, or on a long run the fade eats metres of the shadow it is
      // meant to finish.
      g.globalCompositeOperation = 'destination-in';
      const h = g.createLinearGradient(0, 0, N, 0);
      h.addColorStop(0, 'rgba(0,0,0,0)');
      h.addColorStop(0.06, 'rgba(0,0,0,1)');
      h.addColorStop(0.94, 'rgba(0,0,0,1)');
      h.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = h;
      g.fillRect(0, 0, N, N);
      g.globalCompositeOperation = 'source-over';
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    cache[kind] = t;
    return t;
  };
})();

/**
 * A shadow quad lying on the floor, in the caller's local frame.
 *
 * Unlit and depth-write-free so it darkens the floor without taking part in
 * the lighting or occluding anything standing in it.
 */
function contactShadow(w, d, x, z, kind) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      map: shadowTexture(kind || 'strip'), transparent: true, opacity: 0.9,
      depthWrite: false, color: 0x000000,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  // Just clear of the floor, or the two planes fight for the same depth.
  m.position.set(x, 0.004, z);
  m.renderOrder = 1;
  return m;
}

/**
 * Brushed stainless: fine vertical striations with a soft sheen across them.
 *
 * A fridge drawn as one flat grey slab is the single most obviously fake thing
 * in a generated kitchen — real stainless is directional, and the direction is
 * what tells the eye it is metal rather than painted board.
 */
function brushedTexture(hex) {
  return canvasTexture(256, 512, (g) => {
    g.fillStyle = hex; g.fillRect(0, 0, 256, 512);
    // A broad cross-sheen first: brushed steel is brighter down its middle.
    const sheen = g.createLinearGradient(0, 0, 256, 0);
    sheen.addColorStop(0, shade(hex, 0.82));
    sheen.addColorStop(0.42, shade(hex, 1.12));
    sheen.addColorStop(0.68, shade(hex, 0.98));
    sheen.addColorStop(1, shade(hex, 0.8));
    g.fillStyle = sheen; g.fillRect(0, 0, 256, 512);
    // Then the brushing itself.
    for (let i = 0; i < 900; i++) {
      g.strokeStyle = shade(hex, 0.9 + Math.random() * 0.22);
      g.globalAlpha = 0.35;
      g.lineWidth = 0.6 + Math.random();
      const x = Math.random() * 256;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke();
    }
    g.globalAlpha = 1;
  }, [1, 1]);
}

/** A fine vertical grain, so a painted door is not a flat fill. */
function facadeTexture(hex) {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = hex; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = shade(hex, 0.97 + Math.random() * 0.06);
      g.lineWidth = 0.7;
      const x = Math.random() * 256;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke();
    }
  }, [1, 1]);
}

// A narrower lens than the eye, on purpose. At 46 degrees the near end of a
// run stretches away from the far end and the cabinets lean; around 36 the
// verticals stay upright, which is how an interior is always photographed.
const camera = new THREE.PerspectiveCamera(36, window.innerWidth/window.innerHeight, 0.05, 100);
// Handles for the test harness, alongside window.__scene: a synthetic drag has
// to know where a run landed on screen before it can aim at one.
window.__camera = camera;
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
let sceneryPoints = []; // the dining set, framed too but never at the kitchen's expense
let ilotGroup = null;
let userMoved = false; // true once the customer has moved the camera themselves
let runOutlines = [];  // runs standing in something else, outlined in red
let warnBoxes = [];    // the outline helpers drawn for them
let runPivots = [];    // one group per run, by run index — the drill-up target

// ── Materials ──────────────────────────────────────────────────────────────
function makeMaterials(m) {
  const std = (color, opts) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(color) }, opts||{}));
  /**
   * A textured surface takes its colour from the map, and only from the map.
   *
   * three multiplies the colour by the map, so passing both applies the hex
   * twice — squared in linear space. #9B6B43 comes out at about a third of
   * its brightness, which reads as a different, darker material than the
   * untextured carcass beside it.
   */
  const painted = (map, opts) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, map }, opts || {}));

  /**
   * Sprayed lacquer: a coloured base under a clear coat.
   *
   * A single roughness cannot describe a gloss door. The paint underneath
   * scatters — it has a grain and a body — while the varnish over it reflects
   * the room almost like glass, and it is that second layer, sharper than
   * anything beneath it, that the eye reads as brillance. A clearcoat is
   * exactly that: a second specular lobe with its own roughness, laid over the
   * base without washing its colour out. One material instance is shared by
   * every door in the kitchen, so the cost is paid once.
   */
  const lacquer = (map, opts) =>
    new THREE.MeshPhysicalMaterial(Object.assign({
      color: 0xffffff, map,
      roughness: 0.34, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.045,
      envMapIntensity: 1.0,
    }, opts || {}));

  // One slab is quarried at a time: the worktop and the crédence behind it are
  // cut from it, so they share a map rather than each drawing their own.
  const stone = stoneTexture(m.worktop);
  return {
    facade:   lacquer(facadeTexture(m.facade)),
    // The carcass reads darker than the front so edges stay legible.
    carcass:  std(new THREE.Color(m.facade).multiplyScalar(0.86), { roughness:0.8, metalness:0 }),
    worktop:  painted(stone, { roughness:0.12, metalness:0.02, envMapIntensity:1.25 }),
    // The same stone, turned up the wall. A whitened tint of the worktop hex
    // was the one invented colour in the scene and it came out pink behind a
    // dark top; a real kitchen returns the slab up as the splashback.
    credence: painted(stone, { roughness:0.15, metalness:0.02, envMapIntensity:1.15 }),
    wall:     std(m.wall,    { roughness:0.96 }),
    floor:    painted(woodTexture(m.floor), { roughness:0.55, envMapIntensity:0.5 }),
    metal:    std(m.metal,   { roughness:0.2, metalness:0.94, envMapIntensity:1.35 }),
    // The plinth is in shadow under the doors, so a near-black one crushes to a
    // solid band. A dark neutral keeps a little of the floor's bounce in it.
    dark:     std('#2A2B2E', { roughness:0.42, metalness:0.2 }),
    glass:    new THREE.MeshPhysicalMaterial({ color:'#BFD4DC', roughness:0.06, metalness:0, transmission:0.85, transparent:true, opacity:0.35, thickness:0.01 }),
    steel:    std('#C7CBCF', { roughness:0.18, metalness:0.95, envMapIntensity:1.35 }),
    // Brushed, for the appliance fronts a flat grey slab was giving away.
    brushed:  new THREE.MeshStandardMaterial({
      color: 0xffffff, map: brushedTexture('#B9BEC4'),
      roughness: 0.28, metalness: 0.88, envMapIntensity: 1.3,
    }),
    // The rubber gasket around a fridge door, and the routed shadow gap a
    // handleless front is opened by.
    gasket:   std('#33383D', { roughness:0.85, metalness:0 }),
    // The routed grip is a shadow, not a black stripe painted on the door.
    grip:     std('#4A5157', { roughness:0.6, metalness:0.4 }),

    /**
     * The furnishing, in its own quiet palette.
     *
     * Deliberately not derived from the customer's colours. Tinting the chairs
     * to match the doors makes the room look like a showroom set built around
     * one swatch, and a dining set that changes colour every time the façade
     * does draws the eye to exactly the thing that is not being sold. A warm
     * neutral sits under any kitchen without competing with it.
     */
    tableTop:  painted(woodTexture('#8A6A4B'), { roughness:0.42, envMapIntensity:0.6 }),
    tableBase: std('#6E5540', { roughness:0.5 }),
    seat:      std('#4A5551', { roughness:0.86, metalness:0 }),
    rug:       std('#CFC7BA', { roughness:0.95 }),
    shade:     std('#2E3234', { roughness:0.5, metalness:0.35, side: THREE.DoubleSide }),
    // The stools in the reference are black wire frames, not brushed steel.
    stoolFrame: std('#1D2124', { roughness:0.42, metalness:0.55 }),
    // The shell matches the frame rather than the dining chairs: the reference
    // stools are black throughout, and two green ones parked at a pale island
    // pulled the eye straight off the kitchen.
    stoolSeat:  std('#23282B', { roughness:0.62, metalness:0.1 }),
    frame:     std('#2A2724', { roughness:0.55 }),
    mount:     std('#F3F0E9', { roughness:0.9 }),
    art:       std('#8C9C96', { roughness:0.8 })
  };
}

/** Box helper: size + centre, in the caller's local frame. */
function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w,0.001), Math.max(h,0.001), Math.max(d,0.001)), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/**
 * A box with a hairline round on its edges, for anything with a face on show.
 *
 * A sharp box edge is geometrically perfect and visually dead: the normal flips
 * in zero distance, so no light ever grazes it and a row of doors merges into
 * one slab with grooves scratched in it. Two millimetres of radius gives every
 * front a lit edge on one side and a dark one on the other, which is what makes
 * the eye read separate panels — the same reason real furniture is eased.
 *
 * Reserved for fronts and worktops. Carcasses and anything boxed in stay on
 * BoxGeometry, since nobody sees their edges and they are the bulk of the mesh
 * count.
 */
function panel(w, h, d, mat, x, y, z, radius) {
  const W = Math.max(w, 0.001), H = Math.max(h, 0.001), D = Math.max(d, 0.001);
  // The radius has to clear half of the smallest side or the geometry inverts.
  const r = Math.max(0.0003, Math.min(radius || MM(2), Math.min(W, H, D) / 2 - 0.0004));
  const m = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 1, r), mat);
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
  g.add(panel(w - GAP*2, h - GAP*2, PANEL_T, mats.facade, x, y, z));
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
    g.add(panel(w - GAP*2, fh - GAP*2, PANEL_T, mats.facade, x, cy, z));
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
  const bottom = Math.min(WORKTOP_TOP + MM(650), ceilingH - MM(300));
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
  g.add(panel(w - GAP*2, h - GAP*2, PANEL_T, body, x, y, z));

  if (kind === 'oven') {
    g.add(box(w*0.66, h*0.5, MM(6), mats.dark, x, y - h*0.04, z + PANEL_T/2 + MM(2)));
    g.add(handle(mats, w*0.78, x, y + h/2 - MM(55), z + PANEL_T/2 + MM(16), false));
  } else if (kind === 'dishwasher') {
    g.add(box(w - GAP*2, MM(45), MM(5), mats.steel, x, y + h/2 - MM(40), z + PANEL_T/2 + MM(2)));
    g.add(handle(mats, w*0.78, x, y + h/2 - MM(110), z + PANEL_T/2 + MM(16), false));
  }
  return g;
}

/**
 * One door of a fridge, built the way the real thing is put together.
 *
 * The old version was a plain steel rectangle with a stick handle bolted to
 * it, and it was the least convincing object in the kitchen — a fridge is
 * mostly a big flat face, so every detail it does have carries weight. What is
 * here is what you actually see across a room: brushed steel running
 * vertically, a black gasket set in around the edge, a recessed grip down one
 * side rather than a bar in front of it, and on the fridge door a slim display.
 */
function fridgeDoor(mats, w, h, x, y, z, isFridge) {
  const g = new THREE.Group();
  const fw = w - GAP*2, fh = h - GAP*2;

  // The gasket sits proud at the edges; the door face is inset inside it.
  g.add(panel(fw, fh, PANEL_T, mats.gasket, x, y, z, MM(3)));
  const inset = MM(14);
  g.add(panel(fw - inset*2, fh - inset*2, PANEL_T + MM(4), mats.brushed, x, y, z + MM(2), MM(4)));

  /**
   * A routed grip down the handle side, not a bar in front of the door.
   *
   * Three boxes: a dark recess, and the lip above and below it. It costs the
   * same as the old cylinder and reads as the handleless fronts every modern
   * kitchen in the reference photography actually has.
   */
  const gx = x + fw/2 - inset - MM(30);
  const gripH = Math.min(fh - inset*2 - MM(60), MM(520));
  g.add(box(MM(30), gripH, MM(18), mats.grip, gx, y, z + PANEL_T/2 - MM(4)));
  g.add(box(MM(36), MM(8), MM(22), mats.steel, gx, y + gripH/2, z + PANEL_T/2 + MM(2)));
  g.add(box(MM(36), MM(8), MM(22), mats.steel, gx, y - gripH/2, z + PANEL_T/2 + MM(2)));

  if (isFridge) {
    // A display, dark glass with a faint lit readout.
    const dw = Math.min(fw * 0.42, MM(220)), dh = MM(90);
    const dy = y + fh/2 - inset - MM(90);
    g.add(panel(dw, dh, MM(8), mats.dark, x - fw*0.16, dy, z + PANEL_T/2 + MM(6), MM(3)));
    const lit = new THREE.Mesh(
      new THREE.PlaneGeometry(dw * 0.52, MM(20)),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#9FD8FF') }),
    );
    lit.position.set(x - fw*0.16, dy, z + PANEL_T/2 + MM(11));
    g.add(lit);
  }
  return g;
}

// ── Cabinet builders ───────────────────────────────────────────────────────
function baseUnit(mats, mod, ox, ceilingH) {
  const g = new THREE.Group();
  const w = MM(mod.widthMm), d = MM(mod.depthMm);
  const x = ox + w/2, carcassD = d - PANEL_T;

  // A range is one appliance from floor to worktop, so it stands in place of
  // the cabinet rather than on top of one — no plinth, no carcass, no front.
  if (mod.fixture === 'range') {
    g.add(gasRange(mats, w, d, x));
    return g;
  }

  g.add(box(w, PLINTH_H, carcassD - PLINTH_INSET, mats.dark, x, PLINTH_H/2, (carcassD - PLINTH_INSET)/2));
  g.add(box(w, CARCASS_H, carcassD, mats.carcass, x, PLINTH_H + CARCASS_H/2, carcassD/2));

  const fy = PLINTH_H + CARCASS_H/2, fz = carcassD + PANEL_T/2;
  if (mod.fixture === 'dishwasher') g.add(appliancePanel(mats, w, CARCASS_H, x, fy, fz, 'dishwasher'));
  else if (mod.fixture === 'oven') g.add(appliancePanel(mats, w, CARCASS_H, x, fy, fz, 'oven'));
  else if (mod.drawers) g.add(drawerFronts(mats, w, CARCASS_H, mod.drawers, x, fy, fz));
  else if (mod.widthMm > 700) {
    // Wide cabinets take a pair of doors rather than one unliftable slab.
    g.add(doorFront(mats, w/2, CARCASS_H, x - w/4, fy, fz));
    g.add(doorFront(mats, w/2, CARCASS_H, x + w/4, fy, fz));
  } else g.add(doorFront(mats, w, CARCASS_H, x, fy, fz));

  if (mod.fixture === 'sink') g.add(sink(mats, w, x, d/2, d));
  if (mod.fixture === 'hob') g.add(hob(mats, w, x, d/2, d));
  if (mod.fixture === 'warming') g.add(warmingPlate(mats, w, x, d/2, d));
  return g;
}

/**
 * The LED strip tucked under a wall unit, and the light it throws.
 *
 * The one detail every modern kitchen photograph has and no generated one
 * does: a warm line under the wall cupboards washing down the splashback.
 *
 * Only the emissive sliver is built here. The lamps that make it actually
 * light anything are added once per run, not once per cupboard — a U kitchen
 * has eight wall units, and eight point lights is eight more forward-render
 * passes over every surface in the scene, which is a real cost on the mid-range
 * Android the brief asks this to run on.
 */
function underLight(mats, w, x, bottom, depth) {
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(w - MM(90), MM(10), MM(26)),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#FFF6E4'),
      emissive: new THREE.Color('#FFDCA6'), emissiveIntensity: 2.6,
    }),
  );
  strip.position.set(x, bottom - MM(8), depth * 0.62);
  return strip;
}

/**
 * The pools the strips throw, spread along a run.
 *
 * Placed low and well forward of the doors: aimed at the worktop, which is what
 * under-cabinet lighting is for. Sitting them close under the cupboards put a
 * perfectly round specular blob on the gloss door above each one, which reads
 * as a rendering fault rather than a lamp.
 */
function underLightPools(span, bottom, depth) {
  const g = new THREE.Group();
  const count = Math.max(1, Math.min(3, Math.round((span[1] - span[0]) / 1.3)));
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const glow = new THREE.PointLight('#FFD9A0', 0.85, 1.6, 2);
    glow.position.set(span[0] + (span[1] - span[0]) * t, bottom - MM(190), depth * 0.95);
    g.add(glow);
  }
  return g;
}

/**
 * Where a wall unit can hang, given the ceiling above it.
 *
 * The standard 550 mm upstand puts the top of a 700 mm cupboard at 2.15 m, so
 * any ceiling below that has cabinets growing through it. Real fitters close
 * the gap above the worktop first and only then use a shorter cupboard, which
 * is the order this follows.
 */
function wallUnitFit(h, ceilingH) {
  const maxTop = ceilingH - MM(20);
  let bottom = WALL_BOTTOM;
  let height = h;
  if (bottom + height > maxTop) {
    bottom = Math.max(WORKTOP_TOP + MM(350), maxTop - height);
    if (bottom + height > maxTop) height = Math.max(MM(280), maxTop - bottom);
  }
  return { bottom, height };
}

function wallUnit(mats, mod, ox, ceilingH) {
  const g = new THREE.Group();
  const w = MM(mod.widthMm), d = MM(mod.depthMm);
  const fit = wallUnitFit(MM(mod.heightMm), ceilingH);
  const WALL_BOTTOM = fit.bottom, h = fit.height;
  const x = ox + w/2;
  if (mod.fixture === 'hood') { g.add(hood(mats, w, x, d/2, d, ceilingH)); return g; }

  const carcassD = d - PANEL_T;
  const fz = carcassD + PANEL_T/2;

  if (mod.fixture === 'glass' || mod.fixture === 'glass-led') {
    const lit = mod.fixture === 'glass-led';
    // Hollow, not the solid block an opaque unit gets: there is no point
    // glazing a door if what lies behind it is a filled box.
    const t = MM(18);
    const interior = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F2F1ED'), roughness: 0.85,
      ...(lit ? { emissive: new THREE.Color('#FFE9BE'), emissiveIntensity: 0.28 } : {}),
    });
    g.add(box(w, h, t, interior, x, WALL_BOTTOM + h/2, t/2));                       // back
    g.add(box(w, t, carcassD, interior, x, WALL_BOTTOM + t/2, carcassD/2));         // bottom
    g.add(box(w, t, carcassD, interior, x, WALL_BOTTOM + h - t/2, carcassD/2));     // top
    for (const sx of [-1, 1]) {
      g.add(box(t, h, carcassD, interior, x + sx*(w/2 - t/2), WALL_BOTTOM + h/2, carcassD/2));
    }
    g.add(glazedInterior(mats, w, h, carcassD, x, WALL_BOTTOM, carcassD/2, lit));
    g.add(glazedFront(mats, w, h, x, WALL_BOTTOM + h/2, fz, lit));
    g.add(underLight(mats, w, x, WALL_BOTTOM, carcassD));
    return g;
  }

  g.add(box(w, h, carcassD, mats.carcass, x, WALL_BOTTOM + h/2, carcassD/2));
  g.add(underLight(mats, w, x, WALL_BOTTOM, carcassD));
  if (mod.fixture === 'microwave') {
    // Sunk into the lower two-thirds, with a cupboard door above it.
    const moH = h * 0.62;
    g.add(appliancePanel(mats, w, moH, x, WALL_BOTTOM + moH/2, fz, 'oven'));
    g.add(doorFront(mats, w, h - moH, x, WALL_BOTTOM + moH + (h - moH)/2, fz));
    return g;
  }

  if (mod.widthMm > 700) {
    g.add(doorFront(mats, w/2, h, x - w/4, WALL_BOTTOM + h/2, fz));
    g.add(doorFront(mats, w/2, h, x + w/4, WALL_BOTTOM + h/2, fz));
  } else g.add(doorFront(mats, w, h, x, WALL_BOTTOM + h/2, fz));
  return g;
}

function column(mats, mod, ox, ceilingH) {
  const g = new THREE.Group();
  const w = MM(mod.widthMm), d = MM(mod.depthMm);
  // A 2.10 m column under a 2.00 m ceiling has to lose the difference.
  const h = Math.min(MM(mod.heightMm), ceilingH - MM(20));
  const x = ox + w/2, carcassD = d - PANEL_T, fz = carcassD + PANEL_T/2;

  g.add(box(w, PLINTH_H, carcassD - PLINTH_INSET, mats.dark, x, PLINTH_H/2, (carcassD - PLINTH_INSET)/2));
  g.add(box(w, h - PLINTH_H, carcassD, mats.carcass, x, PLINTH_H + (h - PLINTH_H)/2, carcassD/2));

  const top = h, bottom = PLINTH_H;
  if (mod.fixture === 'fridge') {
    // The freezer takes the lower third, as a combiné does.
    const split = bottom + (top - bottom) * 0.34;
    g.add(fridgeDoor(mats, w, split - bottom, x, (bottom + split)/2, fz, false));
    g.add(fridgeDoor(mats, w, top - split, x, (split + top)/2, fz, true));
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
    // Eased along its front edge, as a stone top always is — a knife-sharp
    // arris is the one thing no fabricator would ever hand over.
    group.add(panel(w, WORKTOP_T, depth + WORKTOP_OVER, mats.worktop,
      start + w/2, WORKTOP_TOP - WORKTOP_T/2, (depth + WORKTOP_OVER)/2, MM(3)));
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

/**
 * One cabinet, built about its own centre instead of at an offset on a run.
 *
 * A caisson the customer has pulled out into the room is no longer part of a
 * row, so it cannot borrow the row's worktop, its lighting or its shadow — it
 * gets its own top and its own contact shadow, and it is built centred so that
 * turning it pivots where it stands rather than swinging it round a corner.
 *
 * No credence: that is a splashback, and a cabinet in the middle of the floor
 * has no wall to splash.
 */
function freeCabinet(mats, mod, ceilingH) {
  const g = new THREE.Group();
  const w = MM(mod.widthMm), d = MM(mod.depthMm);
  // The builders all lay a module out from its left edge and from its back, so
  // the inner group carries the shift that puts the middle of it on the origin.
  const inner = new THREE.Group();
  inner.position.set(0, 0, -d/2);

  if (mod.slot === 'bas') inner.add(baseUnit(mats, mod, -w/2, ceilingH));
  else if (mod.slot === 'haut') inner.add(wallUnit(mats, mod, -w/2, ceilingH));
  else inner.add(column(mats, mod, -w/2, ceilingH));

  // A base unit standing alone still has a top on it — a range brings its own.
  if (mod.slot === 'bas' && mod.fixture !== 'range') {
    inner.add(panel(w, WORKTOP_T, d + WORKTOP_OVER, mats.worktop,
      0, WORKTOP_TOP - WORKTOP_T/2, (d + WORKTOP_OVER)/2, MM(3)));
  }
  // Anything on the floor casts; a wall unit hangs and does not.
  if (mod.slot !== 'haut') {
    const spill = 0.42;
    inner.add(contactShadow(w + spill, d + spill, 0, (d + spill)/2 - 0.06, 'pool'));
  }
  g.add(inner);
  return g;
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

/**
 * Where a run starts, given the room it is in.
 *
 * A return run is anchored at the corner it turns out of, not stretched to
 * fill its wall — the room can be deeper than the run is long, and a kitchen
 * that floated away from its own corner when the room grew would be wrong.
 * The left one is laid front-to-back so its cabinets face into the room, so
 * its *start* is the far end and the corner is where it finishes.
 */
function placementFor(run) {
  // A run is built from 0..lengthM along x and 0..depth into z, so the group is
  // offset by half of each to put its own centre on the point it is placed at.
  // Turning about that centre is then free, which is what lets a run pivot in
  // place instead of swinging round its corner.
  return {
    pos: [run.x, 0, run.z],
    rotY: -(((run.rotationQuarters || 0) % 4 + 4) % 4) * Math.PI / 2,
    offset: [-run.lengthM/2, 0, -RUN_DEPTH/2],
  };
}

/**
 * Floor, ceiling and the four walls, as one replaceable group.
 *
 * Kept separate from the cabinets so dragging a room handle can rebuild the
 * shell — a dozen boxes — and merely reposition everything else, instead of
 * regenerating a few hundred cabinet meshes on every pointer move.
 */
function buildShell(mats, W, D, H, openings, frames) {
  const shell = new THREE.Group();
  const T = MM(100);
  walls = [];

  /**
   * A soft sweep under everything, wider than the room.
   *
   * Two walls are culled at any moment, so the floor slab used to end in a hard
   * lit edge with the background showing beyond it — the room read as a plank
   * cut out and propped against a wall. Continuing the ground to well past the
   * frame in a neutral close to the backdrop turns that into an infinity sweep,
   * which is how a planner shot is normally staged.
   */
  const sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(W, D) * 14, Math.max(W, D) * 14),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#E7E3DB'), roughness: 0.98 }),
  );
  sweep.rotation.x = -Math.PI/2;
  sweep.position.y = -MM(22);
  sweep.receiveShadow = true;
  shell.add(sweep);

  const floor = box(W, MM(20), D, mats.floor, 0, -MM(10), 0);
  floor.castShadow = false; shell.add(floor);
  ceiling = box(W, MM(20), D, mats.wall, 0, H + MM(10), 0);
  ceiling.castShadow = false; ceilingY = H; shell.add(ceiling);

  // Each wall carries its own openings. Kept in the walls list so the render
  // loop can drop whichever stands between the camera and the kitchen.
  const opsOn = (w) => openings.filter((o) => o.wall === w);
  const defs = [
    { wall:'back',  width:W, pos:[0, 0, -D/2 - T/2], rotY:0,            normal:[0,0,1],  map:(o)=>o.offsetM },
    { wall:'front', width:W, pos:[0, 0,  D/2 + T/2], rotY:Math.PI,      normal:[0,0,-1], map:(o)=>W - o.offsetM - o.widthM },
    { wall:'left',  width:D, pos:[-W/2 - T/2, 0, 0], rotY:Math.PI/2,    normal:[1,0,0],  map:(o)=>D - o.offsetM - o.widthM },
    { wall:'right', width:D, pos:[ W/2 + T/2, 0, 0], rotY:-Math.PI/2,   normal:[-1,0,0], map:(o)=>o.offsetM }
  ];
  for (const d of defs) {
    const ops = opsOn(d.wall).map((o) => Object.assign({}, o, { offsetM: d.map(o) }));
    const g = buildWall(mats, d.width, H, ops, T);
    // Hung inside the wall, and mapped along it the same way an opening is, so
    // a frame on a culled wall disappears with it instead of floating.
    for (const f of (frames || []).filter((x) => x.wall === d.wall)) {
      g.add(wallFrame(mats, Object.assign({}, f, { offsetM: d.map(f) }), T));
    }
    // Segments are built from 0..width; recentre on the wall.
    g.position.set(-d.width/2, 0, 0);
    const holder = new THREE.Group();
    holder.add(g);
    holder.position.set(d.pos[0], d.pos[1], d.pos[2]);
    holder.rotation.y = d.rotY;
    shell.add(holder);
    walls.push({ obj: holder, normal: new THREE.Vector3(d.normal[0], d.normal[1], d.normal[2]), centre: new THREE.Vector3(d.pos[0], H/2, d.pos[2]) });
  }
  return shell;
}

/**
 * A glazed door: a frame with a pane in it, and the shelves showing through.
 *
 * The shelves are what sell it — a plain translucent panel reads as a dirty
 * window rather than a vitrine, because there is nothing behind it to see.
 */
function glazedFront(mats, w, h, x, y, z, lit) {
  const g = new THREE.Group();
  const rail = MM(58);
  const fw = w - GAP*2, fh = h - GAP*2;

  // Frame: two stiles and two rails, in the façade colour.
  g.add(box(fw, rail, PANEL_T, mats.facade, x, y + fh/2 - rail/2, z));
  g.add(box(fw, rail, PANEL_T, mats.facade, x, y - fh/2 + rail/2, z));
  for (const s of [-1, 1]) {
    g.add(box(rail, fh - rail*2, PANEL_T, mats.facade, x + s*(fw/2 - rail/2), y, z));
  }

  const pane = new THREE.Mesh(
    new THREE.BoxGeometry(fw - rail*2, fh - rail*2, MM(5)),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(lit ? '#DCEBFF' : '#C6DCE8'),
      roughness: 0.06, metalness: 0.1,
      transparent: true, opacity: lit ? 0.16 : 0.22,
    }),
  );
  pane.position.set(x, y, z);
  g.add(pane);

  g.add(handle(mats, Math.min(w*0.5, MM(220)), x, y + fh/2 - MM(78), z + PANEL_T/2 + MM(14), false));
  return g;
}

/** Shelves and, on the LED version, the strip that lights them. */
function glazedInterior(mats, w, h, d, x, yBottom, z, lit) {
  const g = new THREE.Group();
  const shelf = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#EFEFEC'), roughness: 0.7,
    ...(lit ? { emissive: new THREE.Color('#FFF4D6'), emissiveIntensity: 0.35 } : {}),
  });
  for (const f of [0.36, 0.68]) {
    g.add(box(w - MM(40), MM(16), d - MM(30), shelf, x, yBottom + h*f, z));
  }
  if (lit) {
    // A warm strip tucked under the top, and the glow it throws.
    const stripMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#FFF6DE'),
      emissive: new THREE.Color('#FFD98A'), emissiveIntensity: 4,
    });
    // One under the top and one under each shelf, which is how these are fitted.
    for (const f of [0.98, 0.68, 0.36]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w - MM(80), MM(9), MM(16)), stripMat);
      strip.position.set(x, yBottom + h*f - MM(24), z + d/2 - MM(34));
      g.add(strip);
    }
    const glow = new THREE.PointLight('#FFDCA0', 1.1, 1.4, 2);
    glow.position.set(x, yBottom + h*0.6, z);
    g.add(glow);
  }
  return g;
}

/**
 * A freestanding gas range: burners and grates on top, oven behind the door.
 *
 * Unlike a built-in hob this is one appliance from floor to worktop, so it
 * replaces the cabinet rather than sitting on it — no plinth, no façade.
 */
function gasRange(mats, w, d, x) {
  const g = new THREE.Group();
  const bodyD = d - PANEL_T;
  const top = WORKTOP_TOP;
  g.add(box(w - GAP*2, top - MM(20), bodyD, mats.steel, x, (top - MM(20))/2 + MM(10), bodyD/2));

  // Oven door: dark glass, a bar handle, and a row of knobs above it.
  const doorH = top * 0.62;
  g.add(box(w - GAP*4, doorH, MM(10), mats.dark, x, doorH/2 + MM(60), bodyD + MM(6)));
  g.add(handle(mats, w*0.7, x, doorH + MM(105), bodyD + MM(22), false));
  for (let i = 0; i < 4; i++) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(MM(19), MM(19), MM(22), 14), mats.metal);
    knob.rotation.x = Math.PI/2;
    knob.position.set(x - w/2 + w*(i + 0.5)/4, doorH + MM(160), bodyD + MM(14));
    g.add(knob);
  }

  // Cast-iron grates over four burners.
  const grate = new THREE.MeshStandardMaterial({ color: new THREE.Color('#26282B'), roughness: 0.75 });
  g.add(box(w - GAP*2, MM(10), bodyD*0.94, mats.dark, x, top + MM(5), bodyD/2));
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
    const cx = x + dx*w*0.2, cz = bodyD/2 + dz*bodyD*0.22;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(MM(42), MM(52), MM(26), 14), grate);
    cap.position.set(cx, top + MM(24), cz);
    g.add(cap);
    for (let k = 0; k < 4; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(MM(150), MM(9), MM(16)), grate);
      bar.rotation.y = (k * Math.PI) / 4;
      bar.position.set(cx, top + MM(36), cz);
      g.add(bar);
    }
  }
  return g;
}

/** A narrow domino warming plate, sunk into the worktop. */
function warmingPlate(mats, w, x, z, depth) {
  const g = new THREE.Group();
  const pw = Math.min(w - MM(50), MM(280)), pd = depth * 0.66, top = WORKTOP_TOP;
  g.add(box(pw, MM(8), pd, mats.dark, x, top + MM(4), z));
  for (const dz of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(MM(52), MM(4), 8, 22), mats.metal);
    ring.rotation.x = Math.PI/2;
    ring.position.set(x, top + MM(10), z + dz*pd*0.24);
    g.add(ring);
  }
  return g;
}

// ── Furnishing ─────────────────────────────────────────────────────────────
/**
 * A round pedestal table.
 *
 * Round rather than rectangular on purpose: it needs no clearance decision
 * about which way it faces, four chairs sit evenly around it whatever the room
 * shape, and a circle among all these boxes is the one thing in the scene that
 * is not a right angle.
 */
function diningTable(mats, r) {
  const g = new THREE.Group();
  const TOP = MM(750), THICK = MM(38);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, THICK, 48), mats.tableTop);
  top.position.y = TOP - THICK/2;
  top.castShadow = true; top.receiveShadow = true;
  g.add(top);

  // A column that flares into a foot, which is what stops a pedestal reading
  // as a pipe holding up a disc.
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(MM(70), MM(105), TOP - THICK - MM(30), 20),
    mats.tableBase,
  );
  col.position.y = (TOP - THICK - MM(30)) / 2 + MM(30);
  col.castShadow = true;
  g.add(col);

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.46, MM(30), 28), mats.tableBase);
  foot.position.y = MM(15);
  foot.castShadow = true;
  g.add(foot);

  // A brass ring around the foot, picking up the handles.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.44, MM(9), 8, 32), mats.metal);
  ring.rotation.x = Math.PI/2;
  ring.position.y = MM(26);
  g.add(ring);
  return g;
}

/**
 * A tub chair: a curved back wrapping a seat, on four splayed legs.
 *
 * The back is an open cylinder segment rather than a flat panel — one
 * one thetaLength and the chair stops looking like a crate. Built facing +z and
 * turned into place by the caller.
 */
function diningChair(mats) {
  const g = new THREE.Group();
  const SEAT = MM(455), W = MM(480), D = MM(460);

  const seat = panel(W, MM(95), D, mats.seat, 0, SEAT, 0, MM(40));
  g.add(seat);

  const BACK_H = MM(360);
  const back = new THREE.Mesh(
    // Open at the front, so it wraps the sitter rather than enclosing them.
    new THREE.CylinderGeometry(W * 0.54, W * 0.54, BACK_H, 28, 1, true, Math.PI * 0.18, Math.PI * 1.64),
    mats.seat,
  );
  back.position.set(0, SEAT + MM(48) + BACK_H/2, MM(10));
  back.castShadow = true;
  g.add(back);
  // A capping rail, so the shell has a visible thickness at the top.
  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(W * 0.54, MM(16), 8, 28, Math.PI * 1.64),
    mats.seat,
  );
  rail.rotation.x = -Math.PI/2;
  rail.rotation.z = -Math.PI * 0.18 - Math.PI * 1.64;
  rail.position.set(0, SEAT + MM(48) + BACK_H, MM(10));
  g.add(rail);

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(MM(15), MM(11), SEAT, 10), mats.metal);
    leg.position.set(sx * W * 0.36, SEAT/2, sz * D * 0.34);
    // Splayed a couple of degrees, the difference between a chair and a stool.
    leg.rotation.z = -sx * 0.055;
    leg.rotation.x = sz * 0.055;
    leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

/** The table, its chairs and the rug they stand on. */
function diningSet(mats, d) {
  const g = new THREE.Group();
  const t = d.table;

  if (d.rugRadiusM > 0) {
    const rug = new THREE.Mesh(
      new THREE.CylinderGeometry(d.rugRadiusM, d.rugRadiusM, MM(12), 40),
      mats.rug,
    );
    // Above the contact shadows, which sit at 4 mm.
    rug.position.set(t.x, MM(7), t.z);
    rug.receiveShadow = true;
    g.add(rug);
  }

  const set = new THREE.Group();
  set.position.set(t.x, 0, t.z);
  set.rotation.y = -(((t.rotationQuarters || 0) % 4 + 4) % 4) * Math.PI / 2;
  set.add(diningTable(mats, t.radiusM));

  const seats = Math.max(0, t.seats || 4);
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2;
    const chair = diningChair(mats);
    const reach = t.radiusM + MM(300);
    chair.position.set(Math.sin(a) * reach, 0, Math.cos(a) * reach);
    // Every chair faces the middle of the table.
    chair.rotation.y = a + Math.PI;
    set.add(chair);
  }
  g.add(set);
  return g;
}

/**
 * A bar stool, pulled up to the island.
 *
 * Built to the same shape as the ones in the client's reference: a slim shell
 * seat on a splayed black frame, with a footrest ring. Its height follows the
 * island's own worktop rather than a catalogue number, so a kitchen built to
 * 110 cm gets stools someone could actually sit on.
 */
function barStool(mats, topM) {
  const g = new THREE.Group();
  const seatY = Math.max(MM(480), topM - MM(300));
  const W = MM(400), D = MM(370);

  g.add(panel(W, MM(70), D, mats.stoolSeat, 0, seatY, 0, MM(30)));
  // A low back, curved the same way the dining chairs are.
  const back = new THREE.Mesh(
    new THREE.CylinderGeometry(W * 0.5, W * 0.5, MM(190), 22, 1, true, Math.PI * 0.22, Math.PI * 1.56),
    mats.stoolSeat,
  );
  back.position.set(0, seatY + MM(130), MM(8));
  back.castShadow = true;
  g.add(back);

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(MM(13), MM(10), seatY, 8), mats.stoolFrame);
    leg.position.set(sx * W * 0.36, seatY / 2, sz * D * 0.34);
    leg.rotation.z = -sx * 0.06;
    leg.rotation.x = sz * 0.06;
    leg.castShadow = true;
    g.add(leg);
  }
  // The footrest, which is what stops a tall stool reading as a chair on stilts.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(W * 0.34, MM(11), 6, 20), mats.stoolFrame);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = MM(230);
  g.add(ring);
  return g;
}

/** A shaded pendant on a flex, hung over the table. */
function pendant(mats, p, ceilingH) {
  const g = new THREE.Group();
  const dropTo = Math.max(MM(1200), ceilingH - p.dropM);

  const flex = new THREE.Mesh(
    new THREE.CylinderGeometry(MM(6), MM(6), ceilingH - dropTo, 6),
    mats.dark,
  );
  flex.position.set(p.x, dropTo + (ceilingH - dropTo) / 2, p.z);
  g.add(flex);

  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(MM(60), MM(230), MM(260), 28, 1, true),
    mats.shade,
  );
  shade.position.set(p.x, dropTo - MM(130), p.z);
  g.add(shade);

  // The bulb, and just enough light to justify it. Kept weak: the room is lit
  // by daylight, and a pendant bright enough to see is bright enough to flatten
  // the shot underneath it.
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(MM(48), 12, 10),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#FFF6E2'),
      emissive: new THREE.Color('#FFD9A0'), emissiveIntensity: 2.4,
    }),
  );
  bulb.position.set(p.x, dropTo - MM(250), p.z);
  g.add(bulb);
  const glow = new THREE.PointLight('#FFD9A0', 1.6, 3.2, 2);
  glow.position.set(p.x, dropTo - MM(280), p.z);
  g.add(glow);
  return g;
}

/**
 * A framed picture, in the flat local frame a wall is built in.
 *
 * Built here rather than in the room so it can be added to the wall's own
 * group: the render loop hides whichever wall stands between the camera and
 * the kitchen, and a frame parented anywhere else would be left hanging in
 * mid-air the moment its wall was culled.
 */
function wallFrame(mats, f, thickness) {
  const g = new THREE.Group();
  const w = f.widthM, h = f.heightM, t = MM(28);
  /**
   * On the inside face, which is +z in a wall's own frame.
   *
   * A wall is built centred on its holder and the room lies to its +z; hanging
   * the picture at -z put it on the outside, behind the plaster, where it was
   * invisible from every angle — and looked exactly like a frame that was
   * never drawn at all.
   */
  const z = thickness / 2 + t / 2;
  const cx = f.offsetM + w / 2, cy = f.sillM + h / 2;

  // Moulding, mount and art: three planes at slightly different depths is all
  // it takes for a frame to read as a frame from across a room.
  g.add(box(w, h, t, mats.frame, cx, cy, z));
  g.add(box(w - MM(70), h - MM(70), t * 0.4, mats.mount, cx, cy, z + t * 0.42));
  g.add(box(w - MM(150), h - MM(150), t * 0.3, mats.art, cx, cy, z + t * 0.55));
  g.traverse((c) => { if (c.isMesh) { c.castShadow = false; c.receiveShadow = true; } });
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
  runOutlines = [];
  warnBoxes = [];
  runPivots = [];

  applyHeights((data.geometry && data.geometry.worktopTopM) || MM(900));
  const mats = makeMaterials(data.materials);
  const W = data.room.widthM, D = data.room.depthM, H = data.room.heightM;
  // Texel density has to follow the room, or a 5 m floor stretches four planks
  // across it and a long worktop smears its veining.
  if (mats.floor.map) mats.floor.map.repeat.set(Math.max(1, W / 1.5), Math.max(1, D / 1.5));
  // Slabs are quarried big. Repeating the tile every 1.4 m shrank the veining
  // to a busy pattern; at 2.4 m it reads as one piece of stone.
  if (mats.worktop.map) mats.worktop.map.repeat.set(Math.max(1, W / 2.4), 1);

  const decor = data.decor || { frames: [] };
  root.add(buildShell(mats, W, D, H, data.openings || [], decor.frames || []));

  /**
   * The kitchen is laid out in its own frame and turned as one piece.
   *
   * Rotating here rather than teaching every wall rule about four orientations
   * is what keeps placementFor to three cases. On an odd quarter the room's
   * width and depth swap roles as far as the layout is concerned, which is why
   * the canonical pair is computed rather than reused.
   */
  const quarters = ((data.rotationQuarters || 0) % 4 + 4) % 4;
  const turned = quarters % 2 === 1;
  const Wc = turned ? D : W;
  const Dc = turned ? W : D;
  const kitchen = new THREE.Group();
  kitchen.rotation.y = -quarters * Math.PI / 2;
  root.add(kitchen);

  data.runs.forEach((run, runIndex) => {
    const p = placementFor(run);
    /**
     * Two nested groups per run, not one.
     *
     * The outer group carries the placement and the quarter turn; the inner one
     * holds the cabinets at the offsets they were authored with, shifted back by
     * half the footprint. Separating them is what makes the turn happen about
     * the run's own centre — and it leaves the inner local x still meaning
     * "distance along the run", which every module builder and the whole drag
     * path already depend on.
     */
    const pivot = new THREE.Group();
    pivot.position.set(p.pos[0], p.pos[1], p.pos[2]);
    pivot.rotation.y = p.rotY;
    const g = new THREE.Group();
    g.position.set(p.offset[0], p.offset[1], p.offset[2]);
    pivot.add(g);
    pivot.userData = {
      key: RUN_KEY + runIndex, isRun: true, runIndex,
      x: run.x, z: run.z, overlaps: !!run.overlaps,
    };

    /**
     * A run's cabinets are the ones still in the row.
     *
     * The rest have been dragged off it and stand on their own somewhere in the
     * room. They still belong to this run on the devis, which is why they are
     * held in its list, but nothing about the row is drawn from them any more:
     * they get no share of its worktop, its lamps or its shadow, and they hang
     * off the room rather than off the run's pivot so that moving the side does
     * not drag them along with it.
     */
    const seated = run.modules.filter((m) => !m.free);
    const loose = run.modules.filter((m) => m.free);

    for (const item of seated) {
      const mod = catalog[item.moduleId];
      if (!mod) continue;
      let mg;
      if (mod.slot === 'bas') mg = baseUnit(mats, mod, item.offsetM, H);
      else if (mod.slot === 'haut') mg = wallUnit(mats, mod, item.offsetM, H);
      else mg = column(mats, mod, item.offsetM, H);
      // The meshes inside sit at their authored offset, so the group itself
      // stays at the origin and its position.x is used purely as a live drag
      // delta. That keeps the builders free of any drag concern.
      mg.userData = {
        key: item.key, runIndex, moduleId: mod.id, slot: mod.slot,
        offsetM: item.offsetM, widthM: MM(mod.widthMm), runGroup: g,
        // Where the middle of it sits in its parent, which is what a two-axis
        // drag moves. Held rather than recomputed so the same line of drag code
        // serves a cabinet in a row and one standing on its own.
        centre: { x: item.offsetM + MM(mod.widthMm)/2, z: MM(mod.depthMm)/2 },
      };
      g.add(mg);
      // Only the cabinets are ever raycast. Which of the two the tap *means* —
      // this cabinet, or the whole side it belongs to — is decided afterwards
      // from what is already selected, not by what the ray hit. Offering both to
      // the raycaster cannot work: the run encloses its cabinets, so the walk up
      // to the nearest tagged ancestor would always stop at the cabinet.
      pickables.push(mg);
    }
    worktopSpans(mats, seated, catalog, g, run.lengthM, data.geometry.credence !== false);

    /**
     * The under-cabinet lamps, once for the whole run.
     *
     * Measured across the wall units actually hung on it, so a run with no
     * cupboards gets no lamps and a short row does not get three.
     */
    let hautMin = Infinity, hautMax = -Infinity;
    for (const item of seated) {
      const mod = catalog[item.moduleId];
      if (!mod || mod.slot !== 'haut' || mod.fixture === 'hood') continue;
      hautMin = Math.min(hautMin, item.offsetM);
      hautMax = Math.max(hautMax, item.offsetM + MM(mod.widthMm));
    }
    if (hautMax > hautMin) {
      g.add(underLightPools([hautMin, hautMax], WALL_BOTTOM, MM(350)));
    }

    // One pool under whatever actually stands on the floor. Measured from the
    // modules rather than the run, so a half-empty run does not trail a shadow
    // along bare boards.
    let floorMin = Infinity, floorMax = -Infinity, floorDepth = MM(600);
    for (const item of seated) {
      const mod = catalog[item.moduleId];
      if (!mod || mod.slot === 'haut') continue;
      floorMin = Math.min(floorMin, item.offsetM);
      floorMax = Math.max(floorMax, item.offsetM + MM(mod.widthMm));
      floorDepth = Math.max(floorDepth, MM(mod.depthMm));
    }
    if (floorMax > floorMin) {
      const spill = 0.42;
      const w = floorMax - floorMin + spill;
      const d = floorDepth + spill;
      // Anchored just behind the wall so the gradient's dark plateau lines up
      // with the cabinet footprint and the falloff lands past the plinth.
      g.add(contactShadow(w, d, (floorMin + floorMax) / 2, d / 2 - 0.06));
    }
    kitchen.add(pivot);
    runPivots[runIndex] = pivot;
    if (run.overlaps) runOutlines.push(pivot);

    for (const item of loose) {
      const mod = catalog[item.moduleId];
      if (!mod) continue;
      const fg = freeCabinet(mats, mod, H);
      fg.position.set(item.free.x, 0, item.free.z);
      fg.rotation.y = -(((item.free.rotationQuarters || 0) % 4 + 4) % 4) * Math.PI / 2;
      fg.userData = {
        key: item.key, runIndex, moduleId: mod.id, slot: mod.slot,
        isFreeModule: true, centre: { x: 0, z: 0 },
      };
      kitchen.add(fg);
      pickables.push(fg);
    }
  });

  // Island: a run of cabinets back to back under one slab.
  if (data.ilot) {
    const g = new THREE.Group();
    const iw = data.ilot.widthM, idp = data.ilot.depthM;
    // The island carries its own worktop height — a breakfast bar is commonly
    // ordered higher than the runs — so its carcass is sized separately.
    const iTop = data.ilot.topM > 0 ? data.ilot.topM : WORKTOP_TOP;
    const iCarcass = Math.max(MM(200), iTop - PLINTH_H - WORKTOP_T);

    // Built about its own centre so it can be turned in place; a corner-anchored
    // island would swing round the corner instead of pivoting where it stands.
    g.position.set(data.ilot.x, 0, data.ilot.z);
    g.rotation.y = -(((data.ilot.rotationQuarters || 0) % 4 + 4) % 4) * Math.PI / 2;

    const carcassD = idp - PANEL_T*2;
    g.add(box(iw, PLINTH_H, carcassD - PLINTH_INSET, mats.dark, 0, PLINTH_H/2, 0));
    g.add(box(iw, iCarcass, carcassD, mats.carcass, 0, PLINTH_H + iCarcass/2, 0));
    const n = Math.max(2, Math.round(iw / 0.6));
    for (let i = 0; i < n; i++) {
      const dw = iw/n;
      g.add(drawerFronts(mats, dw, iCarcass, 3, dw*i + dw/2 - iw/2, PLINTH_H + iCarcass/2, carcassD/2 + PANEL_T/2));
    }
    g.add(panel(iw + MM(60), WORKTOP_T, idp + MM(60), mats.worktop, 0, iTop - WORKTOP_T/2, 0, MM(3)));
    g.add(contactShadow(iw + 0.75, idp + 0.75, 0, 0, 'pool'));
    // The island belongs to no run, so it moves across the floor rather than
    // along a line — tagged here so the drag handler can tell the two apart.
    g.userData = { key: '__ilot', isIlot: true, x: data.ilot.x, z: data.ilot.z };
    ilotGroup = g;
    pickables.push(g);
    root.add(g);
  }

  /**
   * Furnishing, in room coordinates and outside the kitchen group.
   *
   * Added to root rather than to the turned kitchen: the table is placed in the
   * room's own frame, and it is not part of the implantation. Nothing here goes
   * into pickables, so none of it can be selected or dragged — and because the
   * shot is framed on pickables alone, a table can never pull the camera off
   * the kitchen either.
   */
  let decorGroup = null;
  if (decor.table) { decorGroup = diningSet(mats, decor); root.add(decorGroup); }
  // Stools belong to the island, so they are framed with it rather than with
  // the dining set — the island is already part of the subject.
  for (const st of (decor.stools || [])) {
    const stool = barStool(mats, data.ilot ? data.ilot.topM : WORKTOP_TOP);
    stool.position.set(st.x, 0, st.z);
    stool.rotation.y = -(((st.facing % 4) + 4) % 4) * Math.PI / 2;
    root.add(stool);
  }
  if (decor.pendant) root.add(pendant(mats, decor.pendant, H));

  // What the shot is framed on: the corners of every cabinet, not the room.
  // Falls back to the room when nothing was placed, so an empty kitchen still
  // shows something.
  subjectPoints = [];
  sceneryPoints = [];
  // Box3.setFromObject only refreshes an object's descendants, never its
  // ancestors, and root is not in the scene yet — so without this the rotated
  // return runs get measured as if they were still unrotated at the origin,
  // and the shot ends up framed on a kitchen that is not there.
  root.updateMatrixWorld(true);
  const collect = (obj, into) => {
    const bag = into || subjectPoints;
    const b = new THREE.Box3().setFromObject(obj);
    if (b.isEmpty()) return;
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) bag.push(new THREE.Vector3(x, y, z));
  };
  for (const p of pickables) collect(p);
  if (ilotGroup) collect(ilotGroup);
  /**
   * The dining set is framed with the kitchen, though it is not part of it.
   *
   * Framing on the cabinets alone put the table half outside the picture: it
   * stands in the middle of the room, which is exactly the floor a shot fitted
   * to the units does not cover. A cropped table reads as a bug, so the shot
   * widens to hold it. The pendant is left out on purpose — it hangs near the
   * ceiling and would stretch the frame upwards into empty air.
   */
  if (decorGroup) collect(decorGroup, sceneryPoints);
  if (!subjectPoints.length) {
    for (const x of [-W/2, W/2])
      for (const y of [0, H])
        for (const z of [-D/2, D/2]) subjectPoints.push(new THREE.Vector3(x, y, z));
  }

  scene.add(root);
  drawWarnings(data);
  highlight();
  // Only reframe when the kitchen itself changed. Re-injecting after an edit
  // must not throw the camera back to its opening shot.
  // Keyed on the kitchen, not the room: resizing the space leaves the same
  // cabinets on screen, and reframing on every tap of the room buttons would
  // yank the camera out from under the customer.
  /**
   * The quarter turn belongs in here.
   *
   * Without it, turning the kitchen swings it out from under a camera that
   * stays where it was framed — in a room that is wider than it is deep the
   * shot ends up inside the cabinets, looking at the back of a door. Rotation
   * changes where the subject *is*, which is exactly what the framing is keyed
   * to; the customer's own orbiting is still respected through userMoved.
   */
  const shape = H + 'x' + pickables.length + 'x' + quarters + 'x' +
    data.runs.map((r) => r.lengthM).join(',');
  facing = facingFor(quarters);
  if (shape !== framedFor) { framedFor = shape; userMoved = false; fitTo(facing); }
  post({ type:'ready' });
}

/**
 * Outlines whatever is standing in something else, in red.
 *
 * The customer is allowed to overlap two runs — a rearrangement passes through
 * a dozen impossible states on the way to a good one, and refusing the drag
 * each time makes the kitchen feel broken. So the answer is the other half of
 * the brief's clause: let it happen, and say so immediately and unmissably.
 *
 * Drawn with depthTest off so an outline buried inside the very thing it is
 * warning about is still visible — the overlap is exactly the case where the
 * box would otherwise be hidden by geometry.
 */
function drawWarnings(data) {
  for (const b of warnBoxes) root.remove(b);
  warnBoxes = [];
  const targets = runOutlines.slice();
  if (ilotGroup && data.ilot && data.ilot.overlaps) targets.push(ilotGroup);
  for (const t of targets) {
    const box = new THREE.BoxHelper(t, new THREE.Color('#E5342B'));
    box.material.depthTest = false;
    box.material.transparent = true;
    box.material.opacity = 0.95;
    box.renderOrder = 9;
    root.add(box);
    warnBoxes.push(box);
  }
}

// ── Lighting ───────────────────────────────────────────────────────────────
function setupLights(W, D, H) {
  /**
   * Contrast is what was missing.
   *
   * The previous rig stacked a bright hemisphere, a strong ambient, a fill and
   * the environment probe on top of a modest key, so every surface received
   * light from every direction at once. Nothing cast a shadow anybody could
   * see, and a kitchen with no shadows reads as a diagram. These numbers pull
   * the omnidirectional fill right down and let one key do the modelling; the
   * probe still keeps the faces it never reaches off black.
   */
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#C4B49C', 0.34));
  const key = new THREE.DirectionalLight('#FFF3E2', 1.85);
  /**
   * Over the camera's left shoulder, not behind it.
   *
   * The key used to sit at +x +z — the same corner the opening shot is taken
   * from — so every shadow it cast fell away from the lens and hid behind the
   * cabinets that made it. The room looked evenly lit and completely ungrounded.
   * From the left the same lamp throws its shadows across the floor into frame.
   */
  key.position.set(-W*1.1, H*2.4, D*1.15);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 40;
  const s = Math.max(W, D) * 1.2;
  key.shadow.camera.left = -s; key.shadow.camera.right = s;
  key.shadow.camera.top = s;  key.shadow.camera.bottom = -s;
  // Softened well past the old setting. A hard edge under a cabinet is the
  // giveaway of a single lamp in an empty room; a wide penumbra reads as
  // daylight through a window, which is what the shot is meant to be.
  key.shadow.bias = -0.0004;
  // Generous, because the eased edges on the fronts are 2 mm and one shadow
  // texel spans more floor than that — below a texel a surface shadows itself
  // and the fronts come out ruled with dotted lines.
  key.shadow.normalBias = 0.05;
  key.shadow.radius = 5;
  scene.add(key);
  // Bounce off the missing fourth wall, so fronts never go flat black.
  const fill = new THREE.DirectionalLight('#DDE7F2', 0.26);
  fill.position.set(-W, H*0.9, D*2);
  scene.add(fill);
  scene.add(new THREE.AmbientLight('#FFFFFF', 0.07));
}

/**
 * How much of the frame the kitchen fills. 1.0 is a tight fit to its bounding
 * box; above that leaves air around it.
 */
const FILL = 1.08;

/**
 * How much wider the shot may go to keep the dining set in it.
 *
 * 1.2 buys the whole room where the table sits near the kitchen, and refuses
 * it where the table is right across the floor — which is exactly the case
 * that cost the cabinets half their size.
 */
const SCENERY_ROOM = 1.2;

/**
 * The opening angle, as an offset from the subject's centre.
 *
 * Lowered from 0.44 to nearer standing height. Looking down on a kitchen shows
 * a lot of worktop and a lot of floor; from closer to eye level the doors and
 * the wall units face the camera, which is the view the customer recognises as
 * their own room.
 */
const FACE_DIR = [0.40, 0.23, 0.89];

/**
 * The opening angle, turned with the kitchen.
 *
 * Rotating the implantation puts it against a different pair of walls; leaving
 * the camera where it was then shows the customer the blank back of their own
 * cabinets. Turning the viewing direction by the same quarter keeps them
 * looking at the fronts, which is what "move my kitchen to that wall" means.
 */
function facingFor(quarters) {
  const a = -(((quarters % 4) + 4) % 4) * Math.PI / 2;
  const [x, y, z] = FACE_DIR;
  return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
}
/** The direction the current scene was framed from, for a resize to reuse. */
let facing = FACE_DIR;

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
  const extentOf = (points) => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of points) {
      const sx = p.dot(right), sy = p.dot(up), sz = p.dot(dir);
      if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
      if (sz < minZ) minZ = sz; if (sz > maxZ) maxZ = sz;
    }
    return {
      halfW: (maxX - minX) / 2,
      halfH: (maxY - minY) / 2,
      depth: maxZ - minZ,
      centre: new THREE.Vector3()
        .addScaledVector(right, (minX + maxX) / 2)
        .addScaledVector(up, (minY + maxY) / 2)
        .addScaledVector(dir, (minZ + maxZ) / 2),
    };
  };

  const kitchen = extentOf(subjectPoints);
  /**
   * The dining set widens the shot, but only so far.
   *
   * Framed together, a small kitchen with a table across the room lost more
   * than half its on-screen size — the cabinets are what the customer is
   * buying, and they cannot be sacrificed to hold a chair in frame. So the
   * wider fit is taken when it is nearly free and refused when it is not; past
   * the cap the dining set simply runs off the edge, which is what a foreground
   * object does in any photograph of a room.
   */
  const room = sceneryPoints.length
    ? extentOf(subjectPoints.concat(sceneryPoints))
    : kitchen;
  const wider = Math.max(room.halfW / kitchen.halfW, room.halfH / kitchen.halfH);
  const both = wider <= SCENERY_ROOM;
  const halfW = both ? room.halfW : kitchen.halfW;
  const halfH = both ? room.halfH : kitchen.halfH;
  const centre = both ? room.centre : kitchen.centre;
  const minZ = 0, maxZ = both ? room.depth : kitchen.depth;

  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  // The nearest cabinet is what has to clear the frustum, so the subject's own
  // depth is added on top of the distance that fits its silhouette.
  const dist =
    Math.max(halfH / Math.tan(vFov / 2), halfW / Math.tan(hFov / 2)) * FILL +
    (maxZ - minZ) / 2;

  /**
   * Sit the kitchen a little below the middle of the frame.
   *
   * A 5 m run is about 2.4 times as wide as it is tall and a phone is twice as
   * tall as it is wide, so the shot is always fitted on width and there is
   * height to spare — dead space no camera position can remove. Split evenly it
   * lands half on empty wall and half on empty floor, and the foreground floor
   * is the worse half to spend it on. Pushing the subject down banks the slack
   * above it, where a plain wall is a perfectly good backdrop.
   */
  const visibleHalfH = dist * Math.tan(vFov / 2);
  const lift = Math.max(0, visibleHalfH - halfH) * 0.22;

  /**
   * Fog, set from the shot rather than from the room.
   *
   * The ground sweep has to stop somewhere, and a plane's far edge always
   * converges on the horizon — so it arrives as a hard line straight across the
   * frame at eye level. Fading the ground into the backdrop before it gets
   * there is the fix. The near plane sits just past the kitchen so nothing the
   * customer is actually looking at is touched, which is why this is keyed to
   * the camera distance and not to the room: on a phone the shot is fitted on
   * width and stands two to three times further back than the room is wide.
   */
  scene.fog = new THREE.Fog(new THREE.Color('#EDEAE5'), dist * 1.15, dist * 2.9);

  camera.position.copy(centre).addScaledVector(dir, dist).addScaledVector(up, lift);
  controls.target.copy(centre).addScaledVector(up, lift);
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

/** The group a selection key refers to, cabinet or whole run. */
function groupForKey(key) {
  if (key == null) return null;
  if (key.indexOf(RUN_KEY) === 0) return runPivots[Number(key.slice(RUN_KEY.length))] || null;
  return pickables.find((p) => p.userData.key === key) || null;
}

function highlight() {
  if (selectionBox) { root.remove(selectionBox); selectionBox = null; }
  const g = groupForKey(selectedKey);
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

renderer.domElement.addEventListener('pointerdown', (e) => {
  // A touch always beats an in-flight button zoom, and means the camera is the
  // customer's from now on — a resize must not snatch it back.
  zoomTo = null;
  userMoved = true;
  if (!currentScene) return;
  const hit = pickAt(e);


  if (!currentScene.editable) return;
  if (!hit) { select(null); return; }

  /**
   * One tap takes the whole side; a second, inside the side already selected,
   * takes the single cabinet under the finger.
   *
   * The ray only ever finds a cabinet — a run has no surface of its own — so
   * what the tap *means* is decided here, from what is already selected:
   *
   *   nothing, or another side selected -> this cabinet's whole side
   *   this side already selected        -> this cabinet on its own
   *   a cabinet on this side selected   -> stay down here, take this cabinet
   *
   * Which makes tapping a different side back out to that side automatically,
   * and tapping the floor clear everything. No modes, and nothing to teach
   * beyond "tap again to go finer".
   *
   * A cabinet standing free of its run skips the drill-down entirely, in both
   * directions: it is not part of a side, so tapping it takes it straight away,
   * and having it selected does not count as being inside the side it is still
   * listed under.
   */
  let target = hit.group;
  if (!hit.group.userData.isIlot && !hit.group.userData.isFreeModule) {
    const runIndex = hit.group.userData.runIndex;
    const sel = groupForKey(selectedKey);
    const alreadyInside = !!sel && !sel.userData.isIlot && !sel.userData.isFreeModule
      && sel.userData.runIndex === runIndex;
    if (!alreadyInside) target = runPivots[runIndex] || hit.group;
  }

  select(target.userData.key);

  // Slide on a horizontal plane through the grab point, so whatever is moving
  // tracks the finger at the height it was grabbed rather than at the floor.
  dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hit.point);

  if (target.userData.isRun) {
    /**
     * A run moves across the floor in two axes, like the island.
     *
     * Its stored x/z are in the kitchen's frame while the drag happens in the
     * room's, so the delta is applied to the group's *world* position here and
     * converted once, on release, by the host. Nudging the local position by a
     * world delta would go wrong the moment the kitchen is turned.
     */
    const world = new THREE.Vector3();
    target.getWorldPosition(world);
    drag = {
      group: target,
      run: true,
      startPoint: hit.point.clone(),
      startWorld: world,
      startLocal: target.position.clone(),
      moved: false,
    };
    controls.enabled = false;
    renderer.domElement.setPointerCapture(e.pointerId);
    return;
  }

  if (target.userData.isIlot) {
    drag = {
      group: target,
      ilot: true,
      startPoint: hit.point.clone(),
      startX: target.userData.x,
      startZ: target.userData.z,
      moved: false,
    };
  } else {
    /**
     * A single cabinet moves across the floor in two axes, like everything
     * else on it.
     *
     * It used to slide along its run and nowhere else, which meant the only way
     * to put a caisson somewhere else in the room was to move the whole side it
     * was on. Where it ends up — back in the row, on another run, or standing on
     * its own in the middle of the floor — is decided by the host on release;
     * here it simply follows the finger.
     *
     * Tracked as a world point rather than a local nudge because a cabinet in a
     * row hangs off a group that is both turned and offset, so a world delta
     * applied to its local position would go the wrong way the moment its run
     * was not facing front.
     */
    const c = target.userData.centre;
    const world = target.parent.localToWorld(
      new THREE.Vector3(c.x + target.position.x, 0, c.z + target.position.z),
    );
    drag = {
      group: target,
      module: true,
      startPoint: hit.point.clone(),
      startWorld: world,
      centre: c,
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

  if (drag.run) {
    // The delta is a world one; the group's parent may be turned, so it is the
    // world target that is tracked and the host that converts it back.
    const dx = hitPoint.x - drag.startPoint.x;
    const dz = hitPoint.z - drag.startPoint.z;
    if (Math.abs(dx) > 0.002 || Math.abs(dz) > 0.002) drag.moved = true;
    const target = new THREE.Vector3(drag.startWorld.x + dx, 0, drag.startWorld.z + dz);
    drag.lastX = target.x;
    drag.lastZ = target.z;
    drag.group.parent.worldToLocal(target);
    drag.group.position.x = target.x;
    drag.group.position.z = target.z;
    if (selectionBox) selectionBox.update();
    for (const b of warnBoxes) b.update();
    return;
  }

  if (drag.ilot) {
    // Two axes instead of one; the host re-clamps to the room on release.
    const dx = hitPoint.x - drag.startPoint.x;
    const dz = hitPoint.z - drag.startPoint.z;
    if (Math.abs(dx) > 0.002 || Math.abs(dz) > 0.002) drag.moved = true;
    drag.group.position.x = drag.group.userData.x + dx;
    drag.group.position.z = drag.group.userData.z + dz;
    drag.lastX = drag.startX + dx;
    drag.lastZ = drag.startZ + dz;
    if (selectionBox) selectionBox.update();
    for (const b of warnBoxes) b.update();
    return;
  }

  // A single cabinet. Its parent may be turned and offset, so the world target
  // is what is tracked and the group's own position is whatever puts its centre
  // there — the host re-clamps and decides what it landed on.
  const dx = hitPoint.x - drag.startPoint.x;
  const dz = hitPoint.z - drag.startPoint.z;
  if (Math.abs(dx) > 0.002 || Math.abs(dz) > 0.002) drag.moved = true;
  const to = new THREE.Vector3(drag.startWorld.x + dx, 0, drag.startWorld.z + dz);
  drag.lastX = to.x;
  drag.lastZ = to.z;
  drag.group.parent.worldToLocal(to);
  drag.group.position.x = to.x - drag.centre.x;
  drag.group.position.z = to.z - drag.centre.z;
  if (selectionBox) selectionBox.update();
});

function endDrag(e) {
  if (!drag) return;
  const g = drag.group;
  const wasIlot = drag.ilot;
  const wasRun = drag.run;
  const lastX = drag.lastX, lastZ = drag.lastZ;
  const moved = drag.moved;
  drag = null;
  controls.enabled = true;
  try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) {}
  if (!moved) return;
  if (wasRun) post({ type: 'movedRun', runIndex: g.userData.runIndex, x: lastX, z: lastZ });
  else if (wasIlot) post({ type: 'movedIlot', x: lastX, z: lastZ });
  else post({ type: 'movedModule', key: g.userData.key, runIndex: g.userData.runIndex, x: lastX, z: lastZ });
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
  if (!userMoved) fitTo(facing);
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
