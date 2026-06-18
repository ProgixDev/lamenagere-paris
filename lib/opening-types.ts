import type { ImageSourcePropType } from "react-native";

/**
 * Catalog of all possible opening types for doors / windows. A product exposes
 * a subset (chosen by the admin) via `product.openingTypes`; the customer picks
 * one when configuring. `group` decides which reference diagram to show as a
 * guide.
 */
export type OpeningGroup = "window" | "door" | "both";

export interface OpeningTypeMeta {
  key: string;
  label: string;
  group: OpeningGroup;
}

export const OPENING_TYPES: Record<string, OpeningTypeMeta> = {
  battante: { key: "battante", label: "Battante", group: "both" },
  pivotante: { key: "pivotante", label: "Pivotante", group: "both" },
  coulissante: { key: "coulissante", label: "Coulissante", group: "both" },
  oscillo_battante: {
    key: "oscillo_battante",
    label: "Oscillo-battante",
    group: "window",
  },
  soufflet: { key: "soufflet", label: "Soufflet", group: "window" },
  fixe: { key: "fixe", label: "Fixe", group: "window" },
  double_battant: {
    key: "double_battant",
    label: "Double battant",
    group: "door",
  },
};

export function openingTypeLabel(key: string): string {
  return OPENING_TYPES[key]?.label ?? key;
}

/** Reference diagrams provided by the client. */
export const WINDOW_TYPES_DIAGRAM: ImageSourcePropType = require("../assets/images/1000409691.jpg");
export const DOOR_TYPES_DIAGRAM: ImageSourcePropType = require("../assets/images/1000409699.jpg");

/**
 * Picks the diagram that best matches a product's offered types: the door
 * diagram if any door-only type is present, the window diagram if any
 * window-only type is present, otherwise none (only shared types).
 */
export function diagramForTypes(
  keys: string[],
): ImageSourcePropType | null {
  const groups = keys.map((k) => OPENING_TYPES[k]?.group);
  if (groups.includes("door")) return DOOR_TYPES_DIAGRAM;
  if (groups.includes("window")) return WINDOW_TYPES_DIAGRAM;
  return null;
}
