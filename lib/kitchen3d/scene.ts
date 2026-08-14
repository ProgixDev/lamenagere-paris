import { mm, moduleById, MODULES, WORKTOP_TOP_MM } from "./catalog";
import type {
  KitchenConfig,
  KitchenScene,
  PlacedModule,
  Run,
  Wall,
} from "./types";

/**
 * Turns what the customer has already told us into a kitchen.
 *
 * The customer never starts from an empty room: by the time this step opens
 * they have given a shape, three wall lengths and a colour, which is enough to
 * lay out a kitchen that works. They arrive on something plausible and move
 * things around, rather than facing a blank floor and a parts list.
 *
 * Pure: no three.js, no React. The renderer is handed the result.
 */

/** Room defaults when a measurement has not been filled in, metres. */
const FALLBACK = { run1: 3.6, run2: 2.4, run3: 2.4, height: 2.5 };

/** Clearance kept between the corner and the start of a return run. */
const CORNER_CLEARANCE_M = mm(600);

/**
 * Walkway around the island: the width an invented one is sized to leave, and
 * the narrower width below which any island — measured or invented — is called
 * out as a problem. They are different numbers on purpose: aiming for 90 cm
 * does not make 85 cm a fault worth flagging to the admin.
 */
const WALKWAY_M = 0.9;
const MIN_WALKWAY_M = 0.7;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const cm = (v: number | undefined, fallback: number) =>
  v != null && Number.isFinite(v) && v > 0 ? v / 100 : fallback;

/** Metres, or null when the customer left the field empty. */
const cmOrNull = (v: number | undefined) =>
  v != null && Number.isFinite(v) && v > 0 ? v / 100 : null;

export function runsOfShapeKey(shapeKey?: string | null): number {
  return shapeKey === "u" ? 3 : shapeKey === "l" ? 2 : 1;
}

/**
 * Greedy packing along one wall.
 *
 * A run is one-dimensional — modules sit side by side and the only rule is
 * that they fit — so placement is a walk down a list, not a search. `wanted`
 * is tried in order and anything that no longer fits is skipped, then the
 * remainder is padded with storage so the run never ends in a visible gap.
 */
function packRun(lengthM: number, wanted: string[], filler: string[]): PlacedModule[] {
  const placed: PlacedModule[] = [];
  let cursor = 0;
  let n = 0;

  const tryPlace = (moduleId: string) => {
    const mod = moduleById(moduleId);
    if (!mod) return false;
    const w = mm(mod.widthMm);
    if (cursor + w > lengthM + 1e-6) return false;
    placed.push({ key: `${moduleId}-${n++}`, moduleId, offsetM: cursor });
    cursor += w;
    return true;
  };

  for (const id of wanted) tryPlace(id);

  // Pad the tail with the widest filler that still fits, narrowing as we go.
  const byWidth = filler
    .map(moduleById)
    .filter((m): m is NonNullable<typeof m> => !!m)
    .sort((a, b) => b.widthMm - a.widthMm);
  let progress = true;
  while (progress) {
    progress = false;
    for (const mod of byWidth) {
      if (tryPlace(mod.id)) {
        progress = true;
        break;
      }
    }
  }

  return placed;
}

/**
 * Widths of wall unit that cover `spanM` exactly, widest-first.
 *
 * The library only has 600s and 800s, so this is a two-variable search small
 * enough to brute force. An empty result means nothing divides cleanly and the
 * caller should pack what it can.
 */
function tileSpan(spanM: number): number[] {
  const span = Math.round(spanM * 1000);
  for (let eighties = Math.floor(span / 800); eighties >= 0; eighties--) {
    const rest = span - eighties * 800;
    if (rest % 600 === 0) {
      return [...Array(eighties).fill(800), ...Array(rest / 600).fill(600)];
    }
  }
  // Nothing exact — pack 600s and accept the remainder (a 900 corner unit).
  return Array(Math.floor(span / 600)).fill(600);
}

/**
 * Wall units, derived from what is underneath rather than placed by hand.
 *
 * A column already reaches the ceiling, so nothing goes above it; a hob needs
 * a hood and nothing else. Everywhere else takes an ordinary cupboard. Deriving
 * the upper run means moving a base unit keeps the elevation coherent for free.
 */
function wallUnitsOver(baseModules: PlacedModule[], lengthM: number): PlacedModule[] {
  const placed: PlacedModule[] = [];
  let n = 0;

  for (const p of baseModules) {
    const base = moduleById(p.moduleId);
    if (!base || base.slot !== "bas") continue;

    // Columns run floor to ceiling — there is no "above" to fill.
    const width = mm(base.widthMm);
    const id = base.fixture === "hob" ? "haut-hotte-60" : null;

    if (id) {
      const hood = moduleById(id)!;
      placed.push({
        key: `${id}-${n++}`,
        moduleId: id,
        // Centre the hood on the hob, which is wider than a single cupboard.
        offsetM: p.offsetM + (width - mm(hood.widthMm)) / 2,
      });
      continue;
    }

    // Tile the span exactly where the catalogue allows it — a 1200 sink unit
    // wants two 600s, not one 800 and a hole. Only if nothing divides cleanly
    // do we fall back to packing 600s and leaving the remainder.
    let cursor = p.offsetM;
    for (const w of tileSpan(width)) {
      const id = w === 800 ? "haut-simple-80" : "haut-simple-60";
      if (cursor + mm(w) > p.offsetM + width + 1e-6) break;
      if (cursor + mm(w) > lengthM + 1e-6) break;
      placed.push({ key: `${id}-${n++}`, moduleId: id, offsetM: cursor });
      cursor += mm(w);
    }
  }

  return placed;
}

/** Base units per run, in the order a kitchen actually wants them. */
const WANTED: Record<number, string[]> = {
  // Main wall: fridge, sink, hob, oven — the working triangle in one line.
  0: ["colonne-frigo-60", "bas-evier-120", "bas-tiroirs-60", "bas-plaque-60", "colonne-four-60"],
  1: ["bas-lave-vaisselle-60", "bas-tiroirs-60"],
  2: ["colonne-rangement-60"],
};
const FILLER = ["bas-simple-60", "bas-tiroirs-60"];

export function buildScene(config: KitchenConfig): KitchenScene {
  const runCount = runsOfShapeKey(config.shapeKey);

  const run1 = cm(config.run1Cm, FALLBACK.run1);
  const run2 = cm(config.run2Cm, FALLBACK.run2);
  const run3 = cm(config.run3Cm, FALLBACK.run3);
  const heightM = cm(config.heightCm, FALLBACK.height);

  /**
   * The room, which the runs only set a floor under.
   *
   * The smallest room this kitchen can occupy is one exactly as long as the
   * back run and as deep as the longest return — that is the fallback, and it
   * is why an unedited L looks tight: every square metre is cabinet. When the
   * customer gives the real room it is used as given, never rounded, and never
   * allowed below what the runs physically need.
   */
  const minWidth = run1;
  const minDepth = Math.max(
    runCount >= 2 ? run2 : 0,
    runCount >= 3 ? run3 : 0,
    // A straight run has no second wall to measure, so it needs its own floor:
    // one cabinet depth plus room to stand in front of it.
    mm(600) + 0.9,
  );
  const widthM = Math.max(cmOrNull(config.roomLengthCm) ?? minWidth, minWidth);
  const depthM = Math.max(cmOrNull(config.roomWidthCm) ?? minDepth, minDepth);

  /**
   * Worktop height as entered, which moves the carcasses under it: a customer
   * who asks for 95 cm gets 95 cm, not a catalogue 90 with their number filed
   * away in the recap.
   */
  const worktopTopM = cm(config.worktopHeightCm, mm(WORKTOP_TOP_MM));

  const runs: Run[] = [];
  const walls: Wall[] = ["back", "left", "right"];

  for (let i = 0; i < runCount; i++) {
    // A return run cannot start in the corner — the back run's carcass is
    // already there — so it loses one cabinet depth off the top.
    const raw = i === 0 ? run1 : Math.min(i === 1 ? run2 : run3, depthM);
    const lengthM = i === 0 ? raw : Math.max(0, raw - CORNER_CLEARANCE_M);

    const base = packRun(lengthM, WANTED[i] ?? [], FILLER);
    const uppers = wallUnitsOver(base, lengthM);
    runs.push({
      wall: walls[i],
      lengthM,
      // Keys must be unique across the whole scene, not just within the run:
      // the renderer picks and highlights a module by key alone, so two runs
      // numbering their cabinets from zero would select each other's.
      modules: [...base, ...uppers].map((m) => ({ ...m, key: `r${i}-${m.key}` })),
    });
  }

  const scene: KitchenScene = {
    room: { widthM, depthM, heightM },
    runs,
    geometry: { worktopTopM, credence: config.credence !== false },
    openings: [],
    materials: {
      facade: config.facadeHex || "#E8E4DC",
      worktop: config.worktopHex || "#2E2E30",
      wall: "#F4F2EE",
      floor: "#C6AE8F",
      metal: "#B8BCC0",
    },
  };

  if (config.ilot) {
    // The floor left over once the runs have taken their depth.
    const runDepth = mm(600);
    const has = (w: Wall) => runs.some((r) => r.wall === w);
    const xMin = -widthM / 2 + (has("left") ? runDepth : 0);
    const xMax = widthM / 2 - (has("right") ? runDepth : 0);
    const zMin = -depthM / 2 + (has("back") ? runDepth : 0);
    const zMax = depthM / 2;

    /**
     * A measured island is drawn at its measured size, full stop.
     *
     * Only when the îlot block asked for nothing does the size get invented,
     * and then it is shrunk until a walkway survives all round. Quietly
     * resizing an island the customer measured would put a number in the recap
     * that the picture disagrees with — so it is flagged instead.
     */
    const measuredW = cmOrNull(config.ilotLengthCm);
    const measuredD = cmOrNull(config.ilotWidthCm);
    const ilotW = measuredW ?? clamp(xMax - xMin - WALKWAY_M * 2, 1.2, 2.4);
    const ilotD = measuredD ?? clamp(zMax - zMin - WALKWAY_M * 2, 0.7, 1.1);

    scene.ilot = {
      widthM: ilotW,
      depthM: ilotD,
      topM: cm(config.ilotHeightCm, worktopTopM),
      x: (xMin + xMax) / 2,
      z: (zMin + zMax) / 2,
      tight:
        (xMax - xMin - ilotW) / 2 < MIN_WALKWAY_M ||
        (zMax - zMin - ilotD) / 2 < MIN_WALKWAY_M,
    };
  }

  // A door on the wall the camera looks through, so it never fights a run, and
  // a window over the main worktop — the arrangement of most real kitchens.
  scene.openings.push({
    kind: "door",
    wall: "front",
    offsetM: Math.max(0.2, widthM - 1.1),
    widthM: 0.9,
    heightM: 2.05,
    sillM: 0,
  });
  if (widthM > 2.8) {
    scene.openings.push({
      kind: "window",
      wall: "back",
      offsetM: widthM / 2 - 0.6,
      widthM: 1.2,
      heightM: 1.0,
      // The sill clears the worktop the customer asked for, not a standard one.
      sillM: worktopTopM + 0.15,
    });
  }

  return scene;
}

/** What the scene costs, in cents — the same walk the recap and cart will do. */
export function sceneTotalCents(scene: KitchenScene): number {
  let total = 0;
  for (const run of scene.runs) {
    for (const p of run.modules) total += moduleById(p.moduleId)?.priceCents ?? 0;
  }
  return total;
}

/** Modules grouped for a recap line-item list. */
export function sceneBreakdown(scene: KitchenScene) {
  const counts = new Map<string, number>();
  for (const run of scene.runs) {
    for (const p of run.modules) counts.set(p.moduleId, (counts.get(p.moduleId) ?? 0) + 1);
  }
  return MODULES.filter((m) => counts.has(m.id)).map((m) => ({
    module: m,
    quantity: counts.get(m.id)!,
    totalCents: m.priceCents * counts.get(m.id)!,
  }));
}
