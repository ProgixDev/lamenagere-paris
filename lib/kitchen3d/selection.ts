import { moduleById } from "./catalog";
import { sceneTotalCents } from "./scene";
import type { KitchenScene } from "./types";
import type { ConfigSelectionEntry, ConfiguredLayout } from "../types";

/**
 * Reserved id of the synthetic entry carrying the 3D implantation.
 *
 * Mirrors `PRODUCT_COLOR_BLOCK_ID`: no back office block produces it, so the
 * server has to re-attach it after `priceConfiguration` rebuilds the snapshot
 * from real blocks — otherwise the arrangement never reaches the order.
 */
export const LAYOUT_BLOCK_ID = "kitchen-layout";

/** The scene, flattened to what the workshop needs to rebuild the project. */
export function layoutOfScene(scene: KitchenScene): ConfiguredLayout {
  return {
    shape: scene.runs.length === 3 ? "u" : scene.runs.length === 2 ? "l" : "i",
    room: scene.room,
    runs: scene.runs.map((run) => ({
      wall: run.wall,
      lengthM: round(run.lengthM),
      modules: run.modules
        .slice()
        .sort((a, b) => a.offsetM - b.offsetM)
        .map((p) => {
          const mod = moduleById(p.moduleId);
          return {
            moduleId: p.moduleId,
            label: mod?.label ?? p.moduleId,
            slot: mod?.slot ?? "bas",
            offsetM: round(p.offsetM),
            widthMm: mod?.widthMm ?? 0,
            depthMm: mod?.depthMm ?? 0,
            priceCents: mod?.priceCents ?? 0,
          };
        }),
    })),
    ilot: scene.ilot
      ? {
          widthM: round(scene.ilot.widthM),
          depthM: round(scene.ilot.depthM),
          topM: round(scene.ilot.topM),
          rotationQuarters: scene.ilot.rotationQuarters,
          tight: scene.ilot.tight,
        }
      : undefined,
    rotationQuarters: scene.rotationQuarters,
    worktopTopM: round(scene.geometry.worktopTopM),
    credence: scene.geometry.credence,
    modulesTotalCents: sceneTotalCents(scene),
  };
}

/** The configuration entry that carries the layout onto the cart and order. */
export function layoutEntry(scene: KitchenScene): ConfigSelectionEntry {
  return {
    blockId: LAYOUT_BLOCK_ID,
    type: "layout",
    label: "Implantation",
    layout: layoutOfScene(scene),
  };
}

/** How many cabinets the layout places, columns and wall units included. */
export function moduleCount(layout: ConfiguredLayout): number {
  return layout.runs.reduce((n, r) => n + r.modules.length, 0);
}

const round = (v: number) => Math.round(v * 1000) / 1000;
