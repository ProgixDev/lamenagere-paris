import type { ConfigBlock } from "../types";
import type { ConfigState } from "../config-blocks";
import type { KitchenConfig } from "./types";

/**
 * Reads the customer's answers into the description the 3D scene is built from.
 *
 * Everything the render shows has to come from here, or the admin ends up
 * looking at a catalogue kitchen with the customer's name on it. Two things in
 * the back office data need interpreting rather than reading:
 *
 * - the worktop height is an *untagged* measurement (it has no `priceRole`,
 *   because it bills nothing), so it is found by label;
 * - a kitchen has two colour blocks — the units and the worktop — and neither
 *   is flagged as which, so they are told apart by label too.
 *
 * Both are matched loosely and fall back rather than guessing wrong: an
 * unmatched colour block paints the units, which is the safer default, and an
 * unmatched height leaves the standard 900 mm.
 */

/** Accent- and case-insensitive, so "Hauteur plan de travail " still matches. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const isWorktop = (label: string) => norm(label).includes("plan de travail");
const isCredence = (label: string) => norm(label).includes("credence");

export function kitchenConfigFrom(
  blocks: ConfigBlock[],
  state: ConfigState,
  opts: { shapeKey?: string | null; ilot: boolean; productColorHex?: string },
): KitchenConfig {
  const config: KitchenConfig = { shapeKey: opts.shapeKey, ilot: opts.ilot };

  for (const block of blocks) {
    if (block.type !== "measurements") continue;
    for (const field of block.fields ?? []) {
      const raw = state[block.id]?.measurements?.[field.key];
      const value = raw != null && raw !== "" ? parseFloat(raw) : NaN;
      if (!Number.isFinite(value) || value <= 0) continue;

      switch (field.priceRole) {
        case "run1":
          config.run1Cm = value;
          break;
        case "run2":
          config.run2Cm = value;
          break;
        case "run3":
          config.run3Cm = value;
          break;
        case "height":
          config.heightCm = value;
          break;
        default:
          // Untagged: the only one the scene cares about is the worktop height.
          if (isWorktop(field.label)) config.worktopHeightCm = value;
      }
    }
  }

  // The island is measured in its own block, and drawn at those measurements.
  for (const block of blocks) {
    if (block.type !== "ilot") continue;
    for (const field of block.fields ?? []) {
      const raw = state[block.id]?.measurements?.[field.key];
      const value = raw != null && raw !== "" ? parseFloat(raw) : NaN;
      if (!Number.isFinite(value) || value <= 0) continue;
      // `dimensionKey` when the back office set one, the label otherwise —
      // the live blocks leave it unset.
      const label = norm(field.label);
      if (field.dimensionKey === "length" || label.includes("longueur")) {
        config.ilotLengthCm = value;
      } else if (field.dimensionKey === "width" || label.includes("largeur")) {
        config.ilotWidthCm = value;
      } else if (label.includes("hauteur")) {
        config.ilotHeightCm = value;
      }
    }
  }

  /**
   * "Crédence sur le mur" is an accessories block whose two items are Oui and
   * Non, so the answer is read off the chosen item's title. Anything else — no
   * such block, nothing picked — leaves the crédence drawn, which is what a
   * fitted kitchen has by default.
   */
  for (const block of blocks) {
    if (block.type !== "accessories" || !isCredence(block.label)) continue;
    const chosen = state[block.id]?.accessoryIds ?? [];
    const titles = (block.items ?? [])
      .filter((it) => chosen.includes(it.id))
      .map((it) => norm(it.title));
    if (titles.length) config.credence = !titles.every((t) => t.startsWith("non"));
  }

  for (const block of blocks) {
    if (block.type !== "colors") continue;
    const key = state[block.id]?.colorKeys?.[0];
    const hex = (block.options ?? []).find((o) => o.key === key)?.hex;
    if (!hex) continue;
    if (isWorktop(block.label)) config.worktopHex ??= hex;
    else config.facadeHex ??= hex;
  }

  // The product's own colourway stands in for the units when no colour block
  // covered them — it is the same decision, asked in a different place.
  config.facadeHex ??= opts.productColorHex;

  return config;
}
