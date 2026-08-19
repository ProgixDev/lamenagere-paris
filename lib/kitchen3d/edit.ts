import { mm, moduleById } from "./catalog";
import { freeSpot, kitchenToRoom, markOverlaps, roomToKitchen } from "./scene";
import { ilotFootprint, moduleFootprint, runFootprint, RUN_DEPTH_M } from "./types";
import type { FreePlacement, KitchenScene, PlacedModule, Run, Slot } from "./types";

/**
 * The rules for moving, adding and removing a cabinet.
 *
 * A run against a wall is one-dimensional: modules sit side by side and the
 * only question is whether they fit. That is what keeps the sliding rules a few
 * dozen lines instead of a collision solver — there is no second axis to
 * search, so a move along a run is a clamp between the two neighbours.
 *
 * A cabinet is not confined to its run, though. Dragged off one it stands free
 * anywhere on the floor, and pushed back against any run it re-joins the row —
 * so `moveModuleFree` decides which of the two a drag was, and the
 * one-dimensional rules below are what it falls back on for the first case.
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

/**
 * Occupied spans on the same strip as `slot`, excluding `exceptKey`.
 *
 * A cabinet standing free of the run is not in the row and holds no span there:
 * the place it used to occupy is a gap like any other, and its neighbours can
 * slide through it.
 */
function spansOn(run: Run, slot: Slot, exceptKey?: string): Span[] {
  const want = strip(slot);
  return run.modules
    .filter((p) => p.key !== exceptKey && !p.free)
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
/** A key no cabinet in the scene is using, in any run. */
function mintKey(scene: KitchenScene, moduleId: string): string {
  const used = new Set(scene.runs.flatMap((r) => r.modules.map((p) => p.key)));
  let n = 0;
  let key = `${moduleId}-${n}`;
  while (used.has(key)) key = `${moduleId}-${++n}`;
  return key;
}

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

  const key = mintKey(scene, moduleId);

  return {
    scene: withRun(scene, runIndex, [...run.modules, { key, moduleId, offsetM: round(at) }]),
    key,
  };
}

/**
 * How far off a run's line a released cabinet still counts as belonging to it.
 *
 * Generous on purpose. The alternative to landing on a run is standing free in
 * the middle of the floor, and a customer who meant "against this wall" and
 * missed by eight centimetres wants the row, not a caisson hanging off it — so
 * the band is wide enough to forgive an imprecise finger and still narrower
 * than the walkway a free-standing cabinet would be dragged out into.
 */
const ATTACH_ACROSS_M = 0.3;
/** The same forgiveness past either end of the run. */
const ATTACH_ALONG_M = 0.3;

/** A point in the kitchen's frame, brought into a run's own. */
function toRunFrame(run: Run, x: number, z: number) {
  return roomToKitchen(x - run.x, z - run.z, run.rotationQuarters);
}

/** The reverse: a point in a run's frame, put back into the kitchen's. */
function fromRunFrame(run: Run, x: number, z: number) {
  const p = kitchenToRoom(x, z, run.rotationQuarters);
  return { x: p.x + run.x, z: p.z + run.z };
}

/** Where a module sitting on a run stands, in the kitchen's frame. */
function centreOnRun(run: Run, offsetM: number, widthM: number, depthM: number) {
  return fromRunFrame(run, offsetM + widthM / 2 - run.lengthM / 2, depthM / 2 - RUN_DEPTH_M / 2);
}

/** The module carrying `key`, wherever on the scene it is. */
function findPlaced(scene: KitchenScene, key: string): { runIndex: number; placed: PlacedModule } | null {
  for (let i = 0; i < scene.runs.length; i++) {
    const placed = scene.runs[i].modules.find((p) => p.key === key);
    if (placed) return { runIndex: i, placed };
  }
  return null;
}

/** Replaces one module in place, leaving the rest of the scene untouched. */
function withModule(
  scene: KitchenScene,
  runIndex: number,
  key: string,
  edit: (p: PlacedModule) => PlacedModule,
): KitchenScene {
  return withRun(
    scene,
    runIndex,
    scene.runs[runIndex].modules.map((p) => (p.key === key ? edit(p) : p)),
  );
}

/**
 * The nearest offset on `run` where a cabinet of `width` actually fits.
 *
 * Used when a cabinet arrives from outside the row — off another run, or off
 * the floor — where the slide rules have nothing to work with: there is no
 * "where it stands now" to derive bounds from and no neighbour to swap with,
 * because it was not next to anybody. Returns null when the row is full, and
 * the caller leaves the cabinet standing free rather than stacking it on top of
 * whatever is already there.
 */
function nearestGapOffset(
  run: Run,
  slot: Slot,
  exceptKey: string,
  wanted: number,
  width: number,
): number | null {
  const taken = spansOn(run, slot, exceptKey);
  let cursor = 0;
  let best: number | null = null;
  const consider = (from: number, to: number) => {
    if (to - from < width - 1e-6) return;
    let at = Math.min(Math.max(wanted, from), to - width);
    // Flush against whatever bounds the gap, the same alignment a slide gets.
    if (Math.abs(at - from) <= SNAP_M) at = from;
    else if (Math.abs(at - (to - width)) <= SNAP_M) at = to - width;
    if (best == null || Math.abs(at - wanted) < Math.abs(best - wanted)) best = at;
  };
  for (const span of taken) {
    consider(cursor, span.start);
    cursor = Math.max(cursor, span.end);
  }
  consider(cursor, run.lengthM);
  return best == null ? null : round(best);
}

/** A free placement, brought back inside the room it stands in. */
function clampFree(
  scene: KitchenScene,
  widthM: number,
  depthM: number,
  free: FreePlacement,
): FreePlacement {
  const foot = moduleFootprint(widthM, depthM, free.rotationQuarters);
  const turned = ((scene.rotationQuarters % 4) + 4) % 4 % 2 === 1;
  const roomW = turned ? scene.room.depthM : scene.room.widthM;
  const roomD = turned ? scene.room.widthM : scene.room.depthM;
  return {
    x: clampAxis(free.x, roomW, foot.alongX),
    z: clampAxis(free.z, roomD, foot.alongZ),
    rotationQuarters: free.rotationQuarters,
  };
}

/** Moves a module's record from one run's list to another's, or within one. */
function reseat(
  scene: KitchenScene,
  key: string,
  fromRun: number,
  toRun: number,
  offsetM: number,
): KitchenScene {
  const placed = scene.runs[fromRun].modules.find((p) => p.key === key);
  if (!placed) return scene;
  // Built fresh rather than spread, so the free placement is gone rather than
  // carried along to reappear the next time anything reads it.
  const seated: PlacedModule = {
    key: placed.key,
    moduleId: placed.moduleId,
    offsetM: round(offsetM),
  };
  return {
    ...scene,
    runs: scene.runs.map((r, i) => {
      if (i === fromRun && i === toRun) {
        return { ...r, modules: r.modules.map((p) => (p.key === key ? seated : p)) };
      }
      if (i === fromRun) return { ...r, modules: r.modules.filter((p) => p.key !== key) };
      if (i === toRun) return { ...r, modules: [...r.modules, seated] };
      return r;
    }),
  };
}

/**
 * Drags a single cabinet anywhere on the floor.
 *
 * The whole point is that a caisson is not a prisoner of the side it was
 * proposed on: the customer can pull one out into the middle of the room, park
 * it at the end of another run, or push it back into the row it came from —
 * without having to move the whole wall to do it.
 *
 * Which of those a drag was is decided here, from where the finger let go
 * rather than from a mode the customer had to choose first:
 *
 *   released against a run  -> it joins that row, aligned and flush
 *   released anywhere else  -> it stands there, free
 *
 * A drag that never leaves the run it started on is the ordinary slide, so it
 * goes through `moveModule` and keeps the swap-with-your-neighbour behaviour
 * that packing a full row depends on.
 *
 * `x`/`z` arrive in the room's frame, which is where the finger is.
 */
export function moveModuleFree(scene: KitchenScene, key: string, x: number, z: number): KitchenScene {
  const found = findPlaced(scene, key);
  if (!found) return scene;
  const { runIndex, placed } = found;
  const mod = moduleById(placed.moduleId);
  if (!mod) return scene;

  const w = mm(mod.widthMm);
  const d = mm(mod.depthMm);
  const k = roomToKitchen(x, z, scene.rotationQuarters);

  // The run it would join, if it was let go against one. Nearest line wins, so
  // a cabinet dropped in a corner where two runs meet joins the one it is
  // squarest to rather than whichever happens to be first in the list.
  let bestRun = -1;
  let bestAlong = 0;
  let bestAcross = Infinity;
  for (let i = 0; i < scene.runs.length; i++) {
    const run = scene.runs[i];
    const local = toRunFrame(run, k.x, k.z);
    const along = local.x + run.lengthM / 2 - w / 2;
    const across = local.z + RUN_DEPTH_M / 2 - d / 2;
    if (Math.abs(across) > ATTACH_ACROSS_M) continue;
    if (along < -ATTACH_ALONG_M || along > run.lengthM - w + ATTACH_ALONG_M) continue;
    if (Math.abs(across) < Math.abs(bestAcross)) {
      bestRun = i;
      bestAlong = along;
      bestAcross = across;
    }
  }

  if (bestRun >= 0) {
    // Never left its own row: the ordinary slide, neighbour swap and all.
    if (bestRun === runIndex && !placed.free) return moveModule(scene, runIndex, key, bestAlong);
    const landing = nearestGapOffset(scene.runs[bestRun], mod.slot, key, bestAlong, w);
    if (landing != null) return reseat(scene, key, runIndex, bestRun, landing);
    // The row is full. Fall through and leave it standing where it was dropped
    // rather than pushing it into a place that is already taken.
  }

  // Keeps whichever way it was already facing — a cabinet turned to face the
  // room and then nudged along must not spring back to its run's orientation.
  const rotationQuarters = placed.free
    ? placed.free.rotationQuarters
    : scene.runs[runIndex].rotationQuarters;
  const free = clampFree(scene, w, d, { x: k.x, z: k.z, rotationQuarters });
  return withModule(scene, runIndex, key, (p) => ({ ...p, free }));
}

/**
 * Turns a single cabinet a quarter about its own centre.
 *
 * Turning one that is still in the row necessarily takes it out of the row —
 * a caisson at ninety degrees to its neighbours is not on that run any more —
 * so it detaches where it stands instead of refusing. Deliberately not routed
 * back through `moveModuleFree`: a cabinet turned in place is still sitting on
 * its run's line, so the attach test would find that run and seat it straight
 * back, undoing the turn.
 */
export function rotateModule(scene: KitchenScene, key: string): KitchenScene {
  const found = findPlaced(scene, key);
  if (!found) return scene;
  const { runIndex, placed } = found;
  const mod = moduleById(placed.moduleId);
  if (!mod) return scene;

  const w = mm(mod.widthMm);
  const d = mm(mod.depthMm);
  const run = scene.runs[runIndex];
  const at: FreePlacement = placed.free ?? {
    ...centreOnRun(run, placed.offsetM, w, d),
    rotationQuarters: run.rotationQuarters,
  };
  const free = clampFree(scene, w, d, {
    x: at.x,
    z: at.z,
    rotationQuarters: (at.rotationQuarters + 1) % 4,
  });
  return withModule(scene, runIndex, key, (p) => ({ ...p, free }));
}

/**
 * Puts a free-standing cabinet back in its row.
 *
 * The drag can always do this, but not always reach: a caisson pulled out of a
 * row that has since been packed solid has nowhere to land, and a customer who
 * simply wants it back should not have to make space by hand first. Returns the
 * scene unchanged when the row really is full, so the caller can say so.
 */
export function reseatModule(scene: KitchenScene, key: string): KitchenScene {
  const found = findPlaced(scene, key);
  if (!found || !found.placed.free) return scene;
  const { runIndex, placed } = found;
  const mod = moduleById(placed.moduleId);
  if (!mod) return scene;
  const landing = nearestGapOffset(
    scene.runs[runIndex],
    mod.slot,
    key,
    placed.offsetM,
    mm(mod.widthMm),
  );
  if (landing == null) return scene;
  return reseat(scene, key, runIndex, runIndex, landing);
}

/**
 * Where a cabinet would land if it were added now, or -1 for the open floor.
 *
 * Exported so the library can say where a unit is about to go instead of
 * greying it out. "Ne rentre pas" was the honest answer while a cabinet had to
 * live in a row; now that one can stand on its own it is simply wrong, and a
 * disabled button that will not explain itself is the worst version of it.
 */
export function addTargetFor(scene: KitchenScene, preferredRun: number, moduleId: string): number {
  const order = [preferredRun, ...scene.runs.map((_, i) => i)];
  for (const i of order) {
    if (i >= 0 && i < scene.runs.length && addModule(scene, i, moduleId).key) return i;
  }
  return -1;
}

/**
 * Adds a cabinet, and never refuses.
 *
 * The row the customer is working on first, then any other row, and failing
 * both it stands on the open floor for them to place. `addModule` on its own
 * still answers the narrow question — is there a gap on *this* run — which is
 * what the drag path needs; this is the answer to what a customer pressing
 * "Ajouter" means, which is that they want the unit.
 */
export function addModuleAnywhere(
  scene: KitchenScene,
  preferredRun: number,
  moduleId: string,
): { scene: KitchenScene; key: string | null } {
  const mod = moduleById(moduleId);
  if (!mod || !scene.runs.length) return { scene, key: null };

  const target = addTargetFor(scene, preferredRun, moduleId);
  if (target >= 0) return addModule(scene, target, moduleId);

  const runIndex = preferredRun >= 0 && preferredRun < scene.runs.length ? preferredRun : 0;
  const key = mintKey(scene, moduleId);
  const at = freeSpot(scene, mm(mod.widthMm), mm(mod.depthMm));
  // Listed under a run all the same: that is the heading it appears under on
  // the devis, and the row it goes back to if the customer presses Remettre.
  return {
    scene: withRun(scene, runIndex, [
      ...scene.runs[runIndex].modules,
      {
        key,
        moduleId,
        offsetM: 0,
        free: { ...at, rotationQuarters: scene.runs[runIndex].rotationQuarters },
      },
    ]),
    key,
  };
}

/** Whether `key` names a cabinet the customer has stood free of its run. */
export function isFreeModule(scene: KitchenScene, key: string | null): boolean {
  if (!key) return false;
  const found = findPlaced(scene, key);
  return !!found?.placed.free;
}

/** Reserved selection key for the island, which belongs to no run. */
export const ILOT_KEY = "__ilot";

/**
 * Slides the island across the floor.
 *
 * Clamped to the room's walls rather than refused, so pushing it into a wall
 * parks it against that wall. When the island is too big for the room it cannot
 * move at all — the bounds cross — and it is re-centred instead of jumping to a
 * corner.
 *
 * This used to reserve a cabinet's depth along whichever walls had runs against
 * them, which was a fair guess while a run's position *was* its wall. Now that
 * runs stand anywhere, the guess is simply wrong — a run parked in the middle
 * of the floor would have gone on reserving a strip along a wall it left. The
 * island is clamped to the room and any real collision is flagged by
 * `markOverlaps`, which measures the runs where they actually are.
 */
export function moveIlot(scene: KitchenScene, x: number, z: number): KitchenScene {
  if (!scene.ilot) return scene;
  // Measured against the turned footprint, not the raw dimensions — otherwise
  // an island swung round parks half of itself inside a wall.
  const foot = ilotFootprint(scene.ilot);
  const halfW = foot.alongX / 2;
  const halfD = foot.alongZ / 2;

  const xMin = -scene.room.widthM / 2 + halfW;
  const xMax = scene.room.widthM / 2 - halfW;
  const zMin = -scene.room.depthM / 2 + halfD;
  const zMax = scene.room.depthM / 2 - halfD;

  const pick = (v: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);

  return markOverlaps({
    ...scene,
    ilot: { ...scene.ilot, x: round(pick(x, xMin, xMax)), z: round(pick(z, zMin, zMax)) },
  });
}

/** Selection key prefix for a whole run, which is not a module. */
export const RUN_KEY = "__run";
export const runKey = (index: number) => `${RUN_KEY}${index}`;
export const runIndexOfKey = (key: string) =>
  key.startsWith(RUN_KEY) ? Number(key.slice(RUN_KEY.length)) : -1;

/**
 * How close to a wall a dragged run snaps flush against it, metres.
 *
 * Wider than the module snap: a run is pushed with a whole hand's worth of
 * travel on screen, and the customer aiming it at a wall means the wall, not
 * four centimetres off it.
 */
const WALL_SNAP_M = 0.12;

/**
 * Slides a whole run across the floor.
 *
 * The counterpart of `moveIlot`, and deliberately the same shape: clamped to
 * the room rather than refused, so pushing a run into a wall parks it against
 * that wall. Overlaps with other runs are *not* prevented — they are recorded
 * by `markOverlaps` and drawn in red, because a customer rearranging a U passes
 * through a dozen illegal states on the way to a legal one and snatching the
 * drag back each time makes the kitchen feel broken.
 *
 * `x`/`z` arrive in the room's frame, which is where the finger is. Runs live
 * in the kitchen's frame, so the point is un-turned on the way in.
 */
export function moveRun(scene: KitchenScene, runIndex: number, x: number, z: number): KitchenScene {
  const run = scene.runs[runIndex];
  if (!run) return scene;

  const local = roomToKitchen(x, z, scene.rotationQuarters);
  const foot = runFootprint(run);
  // The room's own extent, in the kitchen's frame — on an odd quarter the two
  // swap, exactly as the minimum room size does.
  const turned = ((scene.rotationQuarters % 4) + 4) % 4 % 2 === 1;
  const roomW = turned ? scene.room.depthM : scene.room.widthM;
  const roomD = turned ? scene.room.widthM : scene.room.depthM;

  const halfW = foot.alongX / 2;
  const halfD = foot.alongZ / 2;
  const xMin = -roomW / 2 + halfW, xMax = roomW / 2 - halfW;
  const zMin = -roomD / 2 + halfD, zMax = roomD / 2 - halfD;

  // A run longer than the room it is in cannot be placed legally at all; centre
  // it rather than flinging it into a corner.
  const pick = (v: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);

  let nx = pick(local.x, xMin, xMax);
  let nz = pick(local.z, zMin, zMax);
  // Flush against a wall when close — the aimantation the brief asks for.
  if (Math.abs(nx - xMin) <= WALL_SNAP_M) nx = xMin;
  else if (Math.abs(nx - xMax) <= WALL_SNAP_M) nx = xMax;
  if (Math.abs(nz - zMin) <= WALL_SNAP_M) nz = zMin;
  else if (Math.abs(nz - zMax) <= WALL_SNAP_M) nz = zMax;

  return markOverlaps({
    ...scene,
    runs: scene.runs.map((r, i) => (i === runIndex ? { ...r, x: round(nx), z: round(nz) } : r)),
  });
}

/**
 * Turns a run a quarter about its own centre.
 *
 * Pivots in place rather than swinging round a corner, which is what the island
 * already does and the only version that behaves the way a hand expects. The
 * footprint swaps its axes, so the result is re-clamped into the room — a long
 * run turned broadside in a narrow kitchen would otherwise end up half outside.
 */
export function rotateRun(scene: KitchenScene, runIndex: number): KitchenScene {
  const run = scene.runs[runIndex];
  if (!run) return scene;
  const turnedRun = { ...run, rotationQuarters: (run.rotationQuarters + 1) % 4 };
  const spun = { ...scene, runs: scene.runs.map((r, i) => (i === runIndex ? turnedRun : r)) };
  // Re-clamped by asking moveRun for the position it already has, in the frame
  // moveRun expects.
  const back = kitchenToRoom(turnedRun.x, turnedRun.z, scene.rotationQuarters);
  return moveRun(spun, runIndex, back.x, back.z);
}

/**
 * Everything the customer changed about a proposed kitchen.
 *
 * The configure screen rebuilds the scene from the answers on every render and
 * replays this on top, so whatever is missing here is silently discarded the
 * next time anything re-renders. It cost a round of "the side moves but will not
 * stay" to learn that, which is why capture and replay now sit next to each
 * other and are round-tripped by a test rather than being two hand-written
 * object literals a screen apart.
 */
export interface SceneEdits {
  runs: {
    modules: PlacedModule[];
    x: number;
    z: number;
    rotationQuarters: number;
  }[];
  ilot: { x: number; z: number } | null;
}

/** Everything about `scene` that a rebuild from the answers would not reproduce. */
export function editsOfScene(scene: KitchenScene): SceneEdits {
  return {
    runs: scene.runs.map((r) => ({
      modules: r.modules,
      x: r.x,
      z: r.z,
      rotationQuarters: r.rotationQuarters,
    })),
    ilot: scene.ilot ? { x: scene.ilot.x, z: scene.ilot.z } : null,
  };
}

/**
 * The freshly proposed kitchen, with the customer's changes laid back over it.
 *
 * Positions are re-clamped rather than trusted. What was proposed can differ
 * from what the edits were made against — pivoting the island swaps its
 * footprint, and a piece that fitted lengthways may not fit across — so a
 * remembered position can be illegal by the time it is replayed. Clamping here
 * is what lets the island be turned without the whole arrangement having to be
 * thrown away and proposed again.
 */
export function applyEdits(proposed: KitchenScene, edits: SceneEdits): KitchenScene {
  const laid: KitchenScene = {
    ...proposed,
    runs: proposed.runs.map((r, i) => {
      const e = edits.runs[i];
      return e
        ? { ...r, modules: e.modules, x: e.x, z: e.z, rotationQuarters: e.rotationQuarters }
        : { ...r };
    }),
    ilot:
      proposed.ilot && edits.ilot
        ? { ...proposed.ilot, x: edits.ilot.x, z: edits.ilot.z }
        : proposed.ilot
          ? { ...proposed.ilot }
          : undefined,
  };

  // Clamp-only, deliberately not through moveRun/moveIlot: those also snap to
  // the nearest wall, and a snap re-applied on every render would creep a piece
  // the customer parked just off a wall until it was against it.
  laid.runs = laid.runs.map((r) => {
    const p = clampRunTo(laid, r);
    const positioned = p.x === r.x && p.z === r.z ? r : { ...r, x: p.x, z: p.z };
    // Free-standing cabinets are clamped on the same terms as everything else:
    // the room can be resized under one, and a caisson left standing outside
    // its own walls is worse than one nudged back inside them.
    let changed = false;
    const modules = positioned.modules.map((m) => {
      if (!m.free) return m;
      const mod = moduleById(m.moduleId);
      if (!mod) return m;
      const free = clampFree(laid, mm(mod.widthMm), mm(mod.depthMm), m.free);
      if (free.x === m.free.x && free.z === m.free.z) return m;
      changed = true;
      return { ...m, free };
    });
    return changed ? { ...positioned, modules } : positioned;
  });
  if (laid.ilot) {
    const foot = ilotFootprint(laid.ilot);
    const x = clampAxis(laid.ilot.x, laid.room.widthM, foot.alongX);
    const z = clampAxis(laid.ilot.z, laid.room.depthM, foot.alongZ);
    if (x !== laid.ilot.x || z !== laid.ilot.z) laid.ilot = { ...laid.ilot, x, z };
  }

  return markOverlaps(laid);
}

/** Keeps a centre inside a span of `room`, given how much of it the piece takes. */
function clampAxis(v: number, room: number, extent: number): number {
  const half = extent / 2;
  const lo = -room / 2 + half;
  const hi = room / 2 - half;
  // Too big to fit at all: centre it rather than fling it into a corner.
  return lo > hi ? round((lo + hi) / 2) : round(Math.min(Math.max(v, lo), hi));
}

/** A run's position, brought back inside the room it stands in. */
function clampRunTo(scene: KitchenScene, run: Run): { x: number; z: number } {
  const foot = runFootprint(run);
  const turned = ((scene.rotationQuarters % 4) + 4) % 4 % 2 === 1;
  const roomW = turned ? scene.room.depthM : scene.room.widthM;
  const roomD = turned ? scene.room.widthM : scene.room.depthM;
  return {
    x: clampAxis(run.x, roomW, foot.alongX),
    z: clampAxis(run.z, roomD, foot.alongZ),
  };
}

/** Whether a module would fit anywhere on the run, for greying out a palette. */
export function fitsOnRun(scene: KitchenScene, runIndex: number, moduleId: string): boolean {
  return addModule(scene, runIndex, moduleId).key != null;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
