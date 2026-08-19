import { mm, moduleById, MODULES, WORKTOP_TOP_MM } from "./catalog";
import { ilotFootprint, moduleFootprint, runFootprint, RUN_DEPTH_M } from "./types";
import type {
  Decor,
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
const FALLBACK = { run1: 3.6, run2: 2.4, run3: 2.4, height: 2.1 };

/**
 * The room the customer starts from, before they say otherwise.
 *
 * Sizing it to the runs instead made every unedited kitchen look cramped —
 * every square metre was cabinet. A typical room gives the island somewhere to
 * stand and the customer something to shrink rather than something to grow.
 * Still only a starting point: it can never come out smaller than the kitchen
 * standing in it.
 */
const DEFAULT_ROOM = { widthM: 5.0, depthM: 4.0 };

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

/** Millimetre precision, so a placement never carries float dust into storage. */
const round = (v: number) => Math.round(v * 1000) / 1000;

const cm = (v: number | undefined, fallback: number) =>
  v != null && Number.isFinite(v) && v > 0 ? v / 100 : fallback;

/** Metres, or null when the customer left the field empty. */
const cmOrNull = (v: number | undefined) =>
  v != null && Number.isFinite(v) && v > 0 ? v / 100 : null;

/**
 * The wall a canonical run actually stands against once the kitchen is turned.
 *
 * Clockwise seen from above, which is the direction the renderer turns the
 * group in. Used for the island's free floor, which is measured in the room's
 * own frame rather than the kitchen's.
 */
const WALL_ORDER: Wall[] = ["back", "right", "front", "left"];
export function rotatedWall(wall: Wall, quarters: number): Wall {
  const i = WALL_ORDER.indexOf(wall);
  return i < 0 ? wall : WALL_ORDER[(i + ((quarters % 4) + 4)) % 4];
}

export function runsOfShapeKey(shapeKey?: string | null): number {
  return shapeKey === "u" ? 3 : shapeKey === "l" ? 2 : 1;
}

/**
 * Where a run stands when nobody has moved it yet.
 *
 * This is the old `placementFor` in the renderer, turned inside out. It used to
 * derive a position from the wall enum on every frame, which meant a run had
 * nowhere to record having been moved. Now the same three cases run once, at
 * build time, to seed a position the customer is then free to change.
 *
 * Returns the centre of the run's footprint in the kitchen's own frame, plus
 * the quarter turn that points its fronts into the room. The mapping to quarter
 * turns is fixed by the renderer's convention (`rotation.y = -q * PI/2`):
 * a back run is 0, a left return 3, a right return 1.
 */
export function seedPlacement(
  wall: Wall,
  lengthM: number,
  canonWidth: number,
  canonDepth: number,
  backLenM: number,
): { x: number; z: number; rotationQuarters: number } {
  const d = RUN_DEPTH_M;
  if (wall === "left") {
    // Laid front-to-back so its cabinets face into the room, and anchored at
    // the corner it turns out of rather than stretched to fill its wall.
    return {
      x: -canonWidth / 2 + d / 2,
      z: -canonDepth / 2 + CORNER_CLEARANCE_M + lengthM / 2,
      rotationQuarters: 3,
    };
  }
  if (wall === "right") {
    // Attached to the far end of the back run, not to the room's right wall:
    // once the room can be wider than the kitchen those are different places,
    // and pinning it to the wall leaves the third arm stranded metres away.
    return {
      x: -canonWidth / 2 + backLenM - d / 2,
      z: -canonDepth / 2 + CORNER_CLEARANCE_M + lengthM / 2,
      rotationQuarters: 1,
    };
  }
  return {
    x: -canonWidth / 2 + lengthM / 2,
    z: -canonDepth / 2 + d / 2,
    rotationQuarters: 0,
  };
}

/**
 * Flags every run and the island that is standing in something else.
 *
 * Rectangle against rectangle, axis-aligned, which is exact here because
 * everything turns in quarters. Runs are held in the kitchen's frame and the
 * island in the room's, so one of them has to be converted — the island is
 * converted inwards, since there is only ever one of it.
 *
 * Mutates the scene it is given: it runs at the end of `buildScene` and after
 * every edit, and copying the whole scene to set two booleans is not worth it.
 */
export function markOverlaps(scene: KitchenScene): KitchenScene {
  const boxes = scene.runs.map((run) => {
    const f = runFootprint(run);
    return { x: run.x, z: run.z, w: f.alongX, d: f.alongZ };
  });

  if (scene.ilot) {
    const f = ilotFootprint(scene.ilot);
    const p = roomToKitchen(scene.ilot.x, scene.ilot.z, scene.rotationQuarters);
    // A quarter turn swaps which way the island's own footprint lies, too.
    const turned = ((scene.rotationQuarters % 4) + 4) % 4 % 2 === 1;
    boxes.push({
      x: p.x, z: p.z,
      w: turned ? f.alongZ : f.alongX,
      d: turned ? f.alongX : f.alongZ,
    });
  }

  // A shared edge is not an overlap: runs are meant to meet flush in a corner.
  const EPS = 1e-4;
  const hits = (a: typeof boxes[number], b: typeof boxes[number]) =>
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - EPS &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 - EPS;

  const flagged = boxes.map((_, i) => boxes.some((_, j) => i !== j && hits(boxes[i], boxes[j])));

  scene.runs.forEach((run, i) => { run.overlaps = flagged[i]; });
  if (scene.ilot) scene.ilot.overlaps = flagged[scene.runs.length];
  return scene;
}

/** Every footprint the kitchen occupies, in the room's own frame. */
function occupiedBoxes(scene: {
  runs: Run[];
  ilot?: { x: number; z: number; widthM: number; depthM: number; rotationQuarters: number };
  rotationQuarters: number;
}) {
  const q = ((scene.rotationQuarters % 4) + 4) % 4;
  const turned = q % 2 === 1;
  const boxes = scene.runs.map((run) => {
    const f = runFootprint(run);
    const p = kitchenToRoom(run.x, run.z, q);
    // Turning the kitchen swaps which way each run's footprint lies.
    return { x: p.x, z: p.z, w: turned ? f.alongZ : f.alongX, d: turned ? f.alongX : f.alongZ };
  });
  if (scene.ilot) {
    const f = ilotFootprint(scene.ilot);
    boxes.push({ x: scene.ilot.x, z: scene.ilot.z, w: f.alongX, d: f.alongZ });
  }
  // Cabinets the customer has stood free of their run occupy floor like
  // anything else — a dining table placed straight through one would read as
  // the renderer not knowing the caisson was there. Appended last so the run
  // boxes stay at the front, which is what `placeStools` slices off.
  for (const run of scene.runs) {
    for (const m of run.modules) {
      if (!m.free) continue;
      const mod = moduleById(m.moduleId);
      if (!mod) continue;
      const f = moduleFootprint(mm(mod.widthMm), mm(mod.depthMm), m.free.rotationQuarters);
      const p = kitchenToRoom(m.free.x, m.free.z, q);
      boxes.push({
        x: p.x, z: p.z,
        w: turned ? f.alongZ : f.alongX,
        d: turned ? f.alongX : f.alongZ,
      });
    }
  }
  return boxes;
}

/**
 * Somewhere on the floor a cabinet of this size can stand on its own.
 *
 * Wanted when a caisson is added to a kitchen whose rows are already packed:
 * refusing it was the old answer, and it is a poor one now that a cabinet can
 * legitimately stand anywhere — the customer asked for the unit, so they get
 * the unit and can put it where they like.
 *
 * Toward the front of the room by preference. The cabinetry is usually along
 * the back walls, so that is where the open floor is, and it is also where the
 * camera looks — a new unit that appears behind the island reads as nothing
 * having happened.
 *
 * Falls back to that preferred point when the floor really is full. Overlaps
 * are flagged rather than prevented everywhere else in this module, and an
 * added cabinet quietly not appearing would be worse than one that appears in
 * the way and can be dragged clear.
 *
 * Returns a point in the kitchen's frame, which is where a free placement is
 * held.
 */
export function freeSpot(scene: KitchenScene, widthM: number, depthM: number) {
  const boxes = occupiedBoxes(scene);
  const { widthM: W, depthM: D } = scene.room;
  const halfW = widthM / 2;
  const halfD = depthM / 2;
  /** A little air around it, so it does not arrive looking wedged in. */
  const MARGIN = 0.08;
  const STEP = 0.1;
  const wantZ = D / 2 - halfD - 0.35;

  let best: { x: number; z: number; cost: number } | null = null;
  for (let x = -W / 2 + halfW; x <= W / 2 - halfW + 1e-9; x += STEP) {
    for (let z = -D / 2 + halfD; z <= D / 2 - halfD + 1e-9; z += STEP) {
      const clash = boxes.some(
        (b) =>
          Math.abs(x - b.x) < (widthM + b.w) / 2 + MARGIN &&
          Math.abs(z - b.z) < (depthM + b.d) / 2 + MARGIN,
      );
      if (clash) continue;
      const cost = Math.hypot(x, z - wantZ);
      if (!best || cost < best.cost) best = { x, z, cost };
    }
  }
  const at = best ?? { x: 0, z: wantZ };
  return roomToKitchen(round(at.x), round(at.z), scene.rotationQuarters);
}

/**
 * Pulls stools up to the island, on the side with room to sit.
 *
 * Which side matters: a stool tucked into the 60 cm gangway behind an island
 * is a stool nobody can reach, and it reads as a mistake rather than as
 * seating. Each of the four sides is measured against the cabinetry and the
 * walls, and the roomiest one wins.
 */
function placeStools(
  scene: KitchenScene,
  /**
   * The runs only — never the island.
   *
   * Measuring against every footprint counts the island itself as an obstacle,
   * and since a stool is by definition tucked right up against it, every side
   * came back as blocked and no kitchen ever got seating.
   */
  boxes: { x: number; z: number; w: number; d: number }[],
): Decor["stools"] {
  if (!scene.ilot) return [];
  const f = ilotFootprint(scene.ilot);
  const { widthM: W, depthM: D } = scene.room;
  /** A seated person needs this much floor behind the stool. */
  const SIT_M = 0.75;

  const sides = [
    { nx: 0, nz: 1, along: f.alongX, facing: 2 },
    { nx: 0, nz: -1, along: f.alongX, facing: 0 },
    { nx: 1, nz: 0, along: f.alongZ, facing: 1 },
    { nx: -1, nz: 0, along: f.alongZ, facing: 3 },
  ].map((side) => {
    // The point a stool would sit at, on this side of the island.
    const out = (side.nx ? f.alongX : f.alongZ) / 2 + 0.34;
    const px = scene.ilot!.x + side.nx * out;
    const pz = scene.ilot!.z + side.nz * out;
    let clear = Math.min(
      W / 2 - Math.abs(px),
      D / 2 - Math.abs(pz),
    );
    for (const b of boxes) {
      const dx = Math.max(Math.abs(px - b.x) - b.w / 2, 0);
      const dz = Math.max(Math.abs(pz - b.z) - b.d / 2, 0);
      clear = Math.min(clear, Math.hypot(dx, dz));
    }
    return { ...side, px, pz, clear };
  }).sort((a, b) => b.clear - a.clear);

  const best = sides[0];
  if (best.clear < SIT_M) return [];

  // Two stools, spread along that side but kept inside the island's own length.
  const spread = Math.min(best.along * 0.34, 0.62);
  const tx = -best.nz, tz = best.nx; // along the side, perpendicular to its normal
  return [-1, 1].map((s) => ({
    x: round(best.px + tx * spread * s),
    z: round(best.pz + tz * spread * s),
    facing: best.facing,
  }));
}

/**
 * Finds the floor a dining set can stand on, and dresses it.
 *
 * A grid search rather than anything cleverer: the room is a few metres across,
 * the kitchen is at most four boxes, and the honest answer to "where is there
 * space" is to look. Every candidate must clear the cabinetry by a walkway and
 * the walls by a chair's width; the winner is the one furthest from the
 * kitchen, which puts the table across the room rather than wedged behind the
 * island.
 *
 * Returns an empty decor when nothing fits — a galley kitchen does not get a
 * dining set it has nowhere to put.
 */
export function placeDecor(scene: KitchenScene): Decor {
  const boxes = occupiedBoxes(scene);
  // occupiedBoxes puts the island last; the stools need the cabinetry alone.
  const runBoxes = boxes.slice(0, scene.runs.length);
  const { widthM: W, depthM: D } = scene.room;

  /** How far a chair, pulled out to sit down, reaches past the table's edge. */
  const SEAT_M = 0.62;
  /** Breathing space kept between a chair and the wall behind it. */
  const WALL_M = 0.12;

  const clearOf = (x: number, z: number) => {
    let worst = Infinity;
    for (const b of boxes) {
      // Distance from the point to the box, zero inside it.
      const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0);
      const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0);
      worst = Math.min(worst, Math.hypot(dx, dz));
    }
    return worst;
  };

  /**
   * Largest table first, then smaller, rather than one size that must fit.
   *
   * Demanding a full walkway around a 1.24 m radius meant a U with an island
   * — the case that most wants furnishing — got nothing at all, because the
   * only free floor was the strip in front of the island. A ladder puts a
   * bistro table where a dining table will not go, and still prefers the
   * dining table wherever there is room for one.
   */
  let radiusM = 0;
  let best: { x: number; z: number; clear: number } | null = null;
  const STEP = 0.1;

  for (const r of [0.62, 0.55, 0.48, 0.42, 0.36]) {
    const need = r + SEAT_M;
    const lo = need + WALL_M;
    if (lo * 2 > Math.min(W, D)) continue;
    let found: { x: number; z: number; clear: number } | null = null;
    for (let x = -W / 2 + lo; x <= W / 2 - lo + 1e-9; x += STEP) {
      for (let z = -D / 2 + lo; z <= D / 2 - lo + 1e-9; z += STEP) {
        // The chairs must clear the cabinetry; a walkway beyond that is a
        // preference, expressed by picking the roomiest spot rather than a rule.
        const clear = clearOf(x, z);
        if (clear < need) continue;
        /**
         * Roomiest spot wins, but the near corner is handicapped.
         *
         * The opening shot looks in over the front-right, so the free floor
         * there is exactly the floor between the lens and the kitchen: a table
         * placed on it is cropped by the bottom of the frame and stands in
         * front of the cabinets the customer came to look at. The penalty is
         * small enough that a clearly better spot still wins on merit.
         */
        const nearness = (x / (W / 2)) * 0.18 + (z / (D / 2)) * 0.34;
        const score = clear - nearness;
        if (!found || score > found.clear) found = { x: round(x), z: round(z), clear: score };
      }
    }
    if (found) { radiusM = r; best = found; break; }
  }
  if (!best) return { frames: [], stools: placeStools(scene, runBoxes) };

  /**
   * The picture goes where the wall is actually empty, not next to the table.
   *
   * Hanging it above the table put it behind the cabinets every time: in most
   * kitchens the walls the camera sees are the walls the units stand against.
   * Scanning each wall for its widest free stretch — past the ends of the runs,
   * clear of the door and the window — is what finds the bare plaster a picture
   * would really be hung on.
   */
  const frames: Decor["frames"] = [];
  /** Lower is likelier to be facing the customer on the opening shot. */
  const SEEN: Record<Wall, number> = { back: 0, left: 1, right: 2, front: 3 };
  const FRAME_W = 0.52, FRAME_H = 0.68;
  const NEAR = 0.9;

  /** Where a footprint sits along a given wall, or null if it is nowhere near it. */
  const spanOn = (wall: Wall, b: { x: number; z: number; w: number; d: number }) => {
    if (wall === "back") {
      return b.z - b.d / 2 < -D / 2 + NEAR ? [b.x - b.w / 2 + W / 2, b.x + b.w / 2 + W / 2] : null;
    }
    if (wall === "front") {
      return b.z + b.d / 2 > D / 2 - NEAR ? [W / 2 - (b.x + b.w / 2), W / 2 - (b.x - b.w / 2)] : null;
    }
    if (wall === "left") {
      return b.x - b.w / 2 < -W / 2 + NEAR ? [D / 2 - (b.z + b.d / 2), D / 2 - (b.z - b.d / 2)] : null;
    }
    return b.x + b.w / 2 > W / 2 - NEAR ? [b.z - b.d / 2 + D / 2, b.z + b.d / 2 + D / 2] : null;
  };

  for (const wall of (["back", "left", "right", "front"] as Wall[]).sort((a, b) => SEEN[a] - SEEN[b])) {
    const span = wall === "back" || wall === "front" ? W : D;
    const taken: number[][] = [];
    for (const b of boxes) {
      const sp = spanOn(wall, b);
      if (sp) taken.push(sp);
    }
    for (const o of scene.openings) {
      if (o.wall === wall) taken.push([o.offsetM, o.offsetM + o.widthM]);
    }
    taken.sort((a, b) => a[0] - b[0]);

    // Walk the wall and keep the widest stretch nothing stands in front of.
    let cursor = 0.2, bestGap: number[] | null = null;
    for (const t of taken.concat([[span - 0.2, span]])) {
      if (t[0] - cursor > (bestGap ? bestGap[1] - bestGap[0] : 0)) bestGap = [cursor, t[0]];
      cursor = Math.max(cursor, t[1]);
    }
    if (!bestGap || bestGap[1] - bestGap[0] < FRAME_W + 0.3) continue;
    frames.push({
      wall,
      offsetM: round((bestGap[0] + bestGap[1]) / 2 - FRAME_W / 2),
      widthM: FRAME_W,
      heightM: FRAME_H,
      sillM: 1.15,
    });
    break;
  }

  return {
    stools: placeStools(scene, runBoxes),
    table: {
      x: best.x,
      z: best.z,
      radiusM: round(radiusM),
      seats: 4,
      // Turned so the chairs face across the room rather than always north.
      rotationQuarters: Math.abs(best.x) > Math.abs(best.z) ? 1 : 0,
    },
    rugRadiusM: round(radiusM + SEAT_M * 0.9),
    pendant: { x: best.x, z: best.z, dropM: 0.62 },
    frames,
  };
}

/**
 * Room frame to kitchen frame, and back.
 *
 * The implantation is turned as one piece, so a point the customer touched in
 * the room has to be un-turned before it means anything to a run. Clockwise
 * seen from above, matching `rotation.y = -q * PI/2` in the renderer.
 *
 * The two carried each other's bodies until a free-standing cabinet needed the
 * conversion to be right: three's Y rotation by `-q * PI/2` sends a kitchen
 * point (x, z) to the room point (-z, x) on a quarter turn, not to (z, -x).
 * Nothing showed it, because every existing caller either round-trips through
 * both or only ever ran on an unturned kitchen — a run dragged in a kitchen
 * standing at a quarter turn moved along the wrong axis, and the island's
 * overlap box was tested in the wrong corner.
 */
export function roomToKitchen(x: number, z: number, quarters: number) {
  const q = ((quarters % 4) + 4) % 4;
  if (q === 1) return { x: z, z: -x };
  if (q === 2) return { x: -x, z: -z };
  if (q === 3) return { x: -z, z: x };
  return { x, z };
}

export function kitchenToRoom(x: number, z: number, quarters: number) {
  const q = ((quarters % 4) + 4) % 4;
  if (q === 1) return { x: -z, z: x };
  if (q === 2) return { x: -x, z: -z };
  if (q === 3) return { x: z, z: -x };
  return { x, z };
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
    // A range cooks just like a hob does, so it wants extraction too.
    const id = base.fixture === "hob" || base.fixture === "range" ? "haut-hotte-60" : null;

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
  const quarters = ((config.rotationQuarters ?? 0) % 4 + 4) % 4;
  const turned = quarters % 2 === 1;

  // What the kitchen needs along its own two axes. A return starts one cabinet
  // depth off the back wall and is built to its full measurement, so the floor
  // it needs is the corner plus the run — not the run alone. Getting this wrong
  // is what used to force the return to be shortened instead of the room grown.
  const alongRuns = run1;
  const acrossRuns = Math.max(
    runCount >= 2 ? CORNER_CLEARANCE_M + run2 : 0,
    runCount >= 3 ? CORNER_CLEARANCE_M + run3 : 0,
    // A straight run has no second wall to measure, so it needs its own floor:
    // one cabinet depth plus room to stand in front of it.
    mm(600) + 0.9,
  );
  // Turned a quarter, the long run lies along the room's depth instead, so the
  // minimums swap with it — otherwise rotating into a narrow room would push
  // the kitchen through a wall.
  const minWidth = turned ? acrossRuns : alongRuns;
  const minDepth = turned ? alongRuns : acrossRuns;
  const widthM = Math.max(cmOrNull(config.roomLengthCm) ?? DEFAULT_ROOM.widthM, minWidth);
  const depthM = Math.max(cmOrNull(config.roomWidthCm) ?? DEFAULT_ROOM.depthM, minDepth);

  // The kitchen lays itself out in its own frame; the renderer turns it.
  const canonWidth = turned ? depthM : widthM;
  const canonDepth = turned ? widthM : depthM;

  /**
   * Worktop height as entered, which moves the carcasses under it: a customer
   * who asks for 95 cm gets 95 cm, not a catalogue 90 with their number filed
   * away in the recap.
   */
  const worktopTopM = cm(config.worktopHeightCm, mm(WORKTOP_TOP_MM));

  const runs: Run[] = [];
  const walls: Wall[] = ["back", "left", "right"];

  // The back run's length decides where the right-hand return anchors, so it
  // has to be known before any placement is seeded.
  const backLenM = run1;

  for (let i = 0; i < runCount; i++) {
    /**
     * The measurement is how much cabinetry to build, on every run.
     *
     * Returns used to lose a cabinet's depth off the top, on the reasoning that
     * the back run already occupies the corner — so a 250 cm wall could only
     * hold 190 cm of units. Defensible joinery, and completely invisible: a
     * customer who typed 150 got a single box, and one who typed 100 got an
     * empty wall with no explanation at all.
     *
     * Now the number means what it says. The corner is still kept clear — the
     * return simply starts after it and reaches further into the room — and the
     * room's minimum depth accounts for both, so the space grows to hold what
     * was asked for instead of the kitchen being quietly cut down to fit.
     */
    const asked = i === 0 ? run1 : i === 1 ? run2 : run3;
    // Still capped by the room, for a customer who shrinks it by hand: a run
    // longer than the floor it stands on would leave the space entirely.
    const room = i === 0 ? canonWidth : Math.max(0, canonDepth - CORNER_CLEARANCE_M);
    const lengthM = Math.max(0, Math.min(asked, room));

    const base = packRun(lengthM, WANTED[i] ?? [], FILLER);
    const uppers = wallUnitsOver(base, lengthM);
    runs.push({
      wall: walls[i],
      lengthM,
      ...seedPlacement(walls[i], lengthM, canonWidth, canonDepth, backLenM),
      // Keys must be unique across the whole scene, not just within the run:
      // the renderer picks and highlights a module by key alone, so two runs
      // numbering their cabinets from zero would select each other's.
      modules: [...base, ...uppers].map((m) => ({ ...m, key: `r${i}-${m.key}` })),
    });
  }

  const scene: KitchenScene = {
    room: { widthM, depthM, heightM },
    runs,
    rotationQuarters: quarters,
    geometry: {
      worktopTopM,
      credence: config.credence !== false,
      minRoom: { widthM: minWidth, depthM: minDepth },
    },
    openings: [],
    decor: { frames: [], stools: [] },
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
    const hasCanon = (w: Wall) => runs.some((r) => r.wall === w);
    const backLen = runs.find((r) => r.wall === "back")?.lengthM ?? canonWidth;
    // Measured in the kitchen's own frame, where the third arm stands at the
    // end of the back run rather than against the far wall.
    const cxMin = -canonWidth / 2 + (hasCanon("left") ? runDepth : 0);
    const cxMax = hasCanon("right") ? -canonWidth / 2 + backLen - runDepth : canonWidth / 2;
    const czMin = -canonDepth / 2 + (hasCanon("back") ? runDepth : 0);
    const czMax = canonDepth / 2;
    // Back to the room's frame, which is where the island is positioned.
    const turnedRoom = quarters % 2 === 1;
    const xMin = turnedRoom ? czMin : cxMin;
    const xMax = turnedRoom ? czMax : cxMax;
    const zMin = turnedRoom ? cxMin : czMin;
    const zMax = turnedRoom ? cxMax : czMax;

    /**
     * A measured island is drawn at its measured size, full stop.
     *
     * Only when the îlot block asked for nothing does the size get invented,
     * and then it is shrunk until a walkway survives all round. Quietly
     * resizing an island the customer measured would put a number in the recap
     * that the picture disagrees with — so it is flagged instead.
     */
    const ilotQuarters = ((config.ilotRotationQuarters ?? 0) % 4 + 4) % 4;
    const turnedIlot = ilotQuarters % 2 === 1;
    // An invented island is sized to the space it will actually occupy, which
    // is the space the long side ends up facing once it is turned.
    const spanX = xMax - xMin, spanZ = zMax - zMin;
    const roomForLength = turnedIlot ? spanZ : spanX;
    const roomForDepth = turnedIlot ? spanX : spanZ;

    const measuredW = cmOrNull(config.ilotLengthCm);
    const measuredD = cmOrNull(config.ilotWidthCm);
    const ilotW = measuredW ?? clamp(roomForLength - WALKWAY_M * 2, 1.2, 2.4);
    const ilotD = measuredD ?? clamp(roomForDepth - WALKWAY_M * 2, 0.7, 1.1);

    const foot = ilotFootprint({ widthM: ilotW, depthM: ilotD, rotationQuarters: ilotQuarters });
    scene.ilot = {
      widthM: ilotW,
      depthM: ilotD,
      rotationQuarters: ilotQuarters,
      /**
       * The island is built to the same worktop height as the runs.
       *
       * Not "defaults to" — it *is* the same number. The island used to carry
       * its own measurement, on the reasoning that a breakfast bar is often
       * ordered higher; in practice it meant two heights that could drift, and
       * a question the customer had to answer about a surface that should
       * simply match the rest of their kitchen.
       */
      topM: worktopTopM,
      x: (xMin + xMax) / 2,
      z: (zMin + zMax) / 2,
      tight:
        (spanX - foot.alongX) / 2 < MIN_WALKWAY_M ||
        (spanZ - foot.alongZ) / 2 < MIN_WALKWAY_M,
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

  // Dressed last: the table is placed around the cabinetry and the openings,
  // so both have to be final before it can be told where the floor is free.
  scene.decor = placeDecor(scene);

  // A seeded kitchen never overlaps itself, but the island is sized against the
  // floor the runs leave free and a measured one can be bigger than that fits.
  return markOverlaps(scene);
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
