import { mm, moduleById } from "./catalog";
import { rotatedWall } from "./scene";
import { ilotFootprint } from "./types";
import type { KitchenScene, PlacedModule, Run, Slot } from "./types";

/**
 * The rules for moving, adding and removing a cabinet.
 *
 * A run against a wall is one-dimensional: modules sit side by side and the
 * only question is whether they fit. That is what keeps this a few dozen lines
 * instead of a collision solver — there is no second axis to search, so a move
 * is a clamp between the two neighbours and nothing else can be in the way.
 *
 * Authoritative. The renderer clamps too so a drag looks right under the
 * finger, but what it reports back is re-clamped here before it is believed.
 */

/** How close to a neighbour a dragged module snaps flush, metres. */
const SNAP_M = mm(30);

/**
 * Which strip a module competes for. Base units and columns both stand on the
 * floor and collide with each other; wall units live on their own band above.
 */
function strip(slot: Slot): "floor" | "wall" {
  return slot === "haut" ? "wall" : "floor";
}

interface Span {
  key: string;
  start: number;
  end: number;
}

/** Occupied spans on the same strip as `slot`, excluding `exceptKey`. */
function spansOn(run: Run, slot: Slot, exceptKey?: string): Span[] {
  const want = strip(slot);
  return run.modules
    .filter((p) => p.key !== exceptKey)
    .map((p) => ({ p, mod: moduleById(p.moduleId) }))
    .filter((x) => x.mod && strip(x.mod.slot) === want)
    .map((x) => ({
      key: x.p.key,
      start: x.p.offsetM,
      end: x.p.offsetM + mm(x.mod!.widthMm),
    }))
    .sort((a, b) => a.start - b.start);
}

/** Replaces one run, leaving the rest of the scene untouched. */
function withRun(scene: KitchenScene, runIndex: number, modules: PlacedModule[]): KitchenScene {
  return {
    ...scene,
    runs: scene.runs.map((r, i) => (i === runIndex ? { ...r, modules } : r)),
  };
}

/**
 * Slides a module along its run to the nearest legal position.
 *
 * Never refuses the drag: the module stops against whatever is next to it
 * rather than snapping back, which is what makes the gesture feel like pushing
 * furniture instead of failing a validation.
 */
export function moveModule(
  scene: KitchenScene,
  runIndex: number,
  key: string,
  desiredOffsetM: number,
): KitchenScene {
  const run = scene.runs[runIndex];
  if (!run) return scene;
  const placed = run.modules.find((p) => p.key === key);
  const mod = placed && moduleById(placed.moduleId);
  if (!placed || !mod) return scene;

  const width = mm(mod.widthMm);
  const others = spansOn(run, mod.slot, key);

  /**
   * The stretch the module can slide through without passing anyone, measured
   * from where it stands now.
   *
   * Deriving these from the *dragged-to* position instead is wrong in a way
   * that is easy to miss: a neighbour the cursor has landed on top of counts as
   * neither behind nor ahead, so it drops out of the bounds entirely and the
   * cabinet is free to be parked straight through it.
   */
  const prev = others.filter((s) => s.end <= placed.offsetM + 1e-6).pop();
  const next = others.find((s) => s.start >= placed.offsetM + width - 1e-6);
  const min = prev ? prev.end : 0;
  const max = (next ? next.start : run.lengthM) - width;

  /**
   * Dragged decisively past a neighbour, the two trade places.
   *
   * Without this, dragging does nothing at all on most kitchens: the proposed
   * run is packed solid, so almost every cabinet has neighbours on both sides
   * and `min` equals `max`. Swapping keeps the pair inside the exact stretch
   * they already occupied, so nothing outside them can be disturbed and any gap
   * between them survives — it just ends up on the other side.
   */
  const past = (span: Span) => Math.min(mm(300), (span.end - span.start) / 2);
  const target =
    next && desiredOffsetM > max + past(next)
      ? next
      : prev && desiredOffsetM < min - past(prev)
        ? prev
        : null;

  if (target) {
    const other = run.modules.find((p) => p.key === target.key)!;
    const otherWidth = target.end - target.start;
    const from = Math.min(placed.offsetM, target.start);
    const to = Math.max(placed.offsetM + width, target.end);
    const movingRight = target.start > placed.offsetM;
    return withRun(
      scene,
      runIndex,
      run.modules.map((p) => {
        if (p.key === key) return { ...p, offsetM: round(movingRight ? to - width : from) };
        if (p.key === other.key) return { ...p, offsetM: round(movingRight ? from : to - otherWidth) };
        return p;
      }),
    );
  }

  if (max < min) return scene; // Boxed in, and not dragged far enough to swap.

  let landing = Math.min(Math.max(desiredOffsetM, min), max);
  // Flush against a neighbour when close — the automatic alignment the brief asks for.
  if (Math.abs(landing - min) <= SNAP_M) landing = min;
  else if (Math.abs(landing - max) <= SNAP_M) landing = max;

  return withRun(
    scene,
    runIndex,
    run.modules.map((p) => (p.key === key ? { ...p, offsetM: round(landing) } : p)),
  );
}

export function removeModule(scene: KitchenScene, runIndex: number, key: string): KitchenScene {
  const run = scene.runs[runIndex];
  if (!run) return scene;
  return withRun(
    scene,
    runIndex,
    run.modules.filter((p) => p.key !== key),
  );
}

/**
 * Drops a module into the first gap on its run that will take it.
 *
 * Returns the scene unchanged and a null key when nothing fits, so the caller
 * can say so rather than silently placing it on top of something.
 */
export function addModule(
  scene: KitchenScene,
  runIndex: number,
  moduleId: string,
): { scene: KitchenScene; key: string | null } {
  const run = scene.runs[runIndex];
  const mod = moduleById(moduleId);
  if (!run || !mod) return { scene, key: null };

  const width = mm(mod.widthMm);
  const others = spansOn(run, mod.slot);

  let cursor = 0;
  let at: number | null = null;
  for (const s of others) {
    if (s.start - cursor >= width - 1e-6) {
      at = cursor;
      break;
    }
    cursor = Math.max(cursor, s.end);
  }
  if (at == null && run.lengthM - cursor >= width - 1e-6) at = cursor;
  if (at == null) return { scene, key: null };

  // Unique against everything already placed, including in other runs.
  const used = new Set(scene.runs.flatMap((r) => r.modules.map((p) => p.key)));
  let n = 0;
  let key = `${moduleId}-${n}`;
  while (used.has(key)) key = `${moduleId}-${++n}`;

  return {
    scene: withRun(scene, runIndex, [...run.modules, { key, moduleId, offsetM: round(at) }]),
    key,
  };
}

/** Reserved selection key for the island, which belongs to no run. */
export const ILOT_KEY = "__ilot";

/**
 * Slides the island across the floor the runs have left free.
 *
 * Clamped to the centre of its own footprint rather than refused, so pushing it
 * into a wall parks it against that wall. When the island is too big for the
 * space it cannot move at all — the bounds cross — and it is re-centred instead
 * of jumping to a corner.
 */
export function moveIlot(scene: KitchenScene, x: number, z: number): KitchenScene {
  if (!scene.ilot) return scene;
  const runDepth = mm(600);
  const has = (w: string) => scene.runs.some((r) => rotatedWall(r.wall, scene.rotationQuarters) === w);
  // Measured against the turned footprint, not the raw dimensions — otherwise a
  // island swung round parks half of itself inside a wall.
  const foot = ilotFootprint(scene.ilot);
  const halfW = foot.alongX / 2;
  const halfD = foot.alongZ / 2;

  const xMin = -scene.room.widthM / 2 + (has("left") ? runDepth : 0) + halfW;
  const xMax = scene.room.widthM / 2 - (has("right") ? runDepth : 0) - halfW;
  const zMin = -scene.room.depthM / 2 + (has("back") ? runDepth : 0) + halfD;
  const zMax = scene.room.depthM / 2 - halfD;

  const pick = (v: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);

  return {
    ...scene,
    ilot: { ...scene.ilot, x: round(pick(x, xMin, xMax)), z: round(pick(z, zMin, zMax)) },
  };
}

/** Whether a module would fit anywhere on the run, for greying out a palette. */
export function fitsOnRun(scene: KitchenScene, runIndex: number, moduleId: string): boolean {
  return addModule(scene, runIndex, moduleId).key != null;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
