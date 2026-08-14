import type { KitchenModule, Slot } from "./types";

/**
 * The LA MÉNAGÈRE library, at standard French kitchen dimensions.
 *
 * Hard-coded here only so the 3D step can be judged before the back office
 * grows a module editor. Every field maps one-to-one onto `ConfigBlockItem`,
 * so moving this to an admin-managed `modules` block later is a swap of the
 * data source, not a rewrite: `widthMm` / `depthMm` / `heightMm` / `slot` are
 * the four columns that need adding to the block item.
 */

/** Standard carcass depths and heights, millimetres. */
export const GEOM = {
  /** Recess of the plinth behind the door front — the toe kick. */
  plinthInsetMm: 50,
  plinthHeightMm: 120,
  /** Carcass of a base unit, plinth and worktop excluded. */
  baseCarcassHeightMm: 740,
  worktopThicknessMm: 40,
  /** Worktop overhang past the door front. */
  worktopOverhangMm: 20,
  /** Floor to the underside of the wall units. */
  wallUnitBottomMm: 1450,
  /** Doors and drawer fronts. */
  panelThicknessMm: 18,
  /** Gap left between two adjacent fronts. */
  panelGapMm: 3,
  crédenceHeightMm: 550,
} as const;

/** Floor to the top of the worktop — the reference height of the whole kitchen. */
export const WORKTOP_TOP_MM =
  GEOM.plinthHeightMm + GEOM.baseCarcassHeightMm + GEOM.worktopThicknessMm;

export const MODULES: KitchenModule[] = [
  // ── Meubles bas ───────────────────────────────────────────────────────────
  {
    id: "bas-simple-60",
    label: "Caisson simple 60",
    slot: "bas",
    widthMm: 600,
    depthMm: 600,
    heightMm: GEOM.baseCarcassHeightMm,
    fixture: null,
    priceCents: 18000,
  },
  {
    id: "bas-tiroirs-60",
    label: "Caisson 3 tiroirs 60",
    slot: "bas",
    widthMm: 600,
    depthMm: 600,
    heightMm: GEOM.baseCarcassHeightMm,
    fixture: null,
    priceCents: 26000,
    drawers: 3,
  },
  {
    id: "bas-evier-120",
    label: "Meuble sous-évier 120",
    slot: "bas",
    widthMm: 1200,
    depthMm: 600,
    heightMm: GEOM.baseCarcassHeightMm,
    fixture: "sink",
    priceCents: 32000,
  },
  {
    id: "bas-plaque-60",
    label: "Meuble plaque de cuisson 60",
    slot: "bas",
    widthMm: 600,
    depthMm: 600,
    heightMm: GEOM.baseCarcassHeightMm,
    fixture: "hob",
    priceCents: 29000,
    drawers: 2,
  },
  {
    id: "bas-angle-90",
    label: "Meuble d'angle 90",
    slot: "bas",
    widthMm: 900,
    depthMm: 600,
    heightMm: GEOM.baseCarcassHeightMm,
    fixture: null,
    priceCents: 34000,
  },
  {
    id: "bas-lave-vaisselle-60",
    label: "Lave-vaisselle intégré 60",
    slot: "bas",
    widthMm: 600,
    depthMm: 600,
    heightMm: GEOM.baseCarcassHeightMm,
    fixture: "dishwasher",
    priceCents: 45000,
  },

  // ── Meubles hauts ─────────────────────────────────────────────────────────
  {
    id: "haut-simple-60",
    label: "Placard mural 60",
    slot: "haut",
    widthMm: 600,
    depthMm: 350,
    heightMm: 700,
    fixture: null,
    priceCents: 15000,
  },
  {
    id: "haut-simple-80",
    label: "Placard mural 80",
    slot: "haut",
    widthMm: 800,
    depthMm: 350,
    heightMm: 700,
    fixture: null,
    priceCents: 18000,
  },
  {
    id: "haut-hotte-60",
    label: "Hotte décorative 60",
    slot: "haut",
    widthMm: 600,
    depthMm: 350,
    heightMm: 700,
    fixture: "hood",
    priceCents: 39000,
  },

  // ── Colonnes ──────────────────────────────────────────────────────────────
  {
    id: "colonne-four-60",
    label: "Colonne four 60",
    slot: "colonne",
    widthMm: 600,
    depthMm: 600,
    heightMm: 2100,
    fixture: "oven",
    priceCents: 52000,
  },
  {
    id: "colonne-four-mo-60",
    label: "Colonne four + micro-ondes 60",
    slot: "colonne",
    widthMm: 600,
    depthMm: 600,
    heightMm: 2100,
    fixture: "microwave",
    priceCents: 68000,
  },
  {
    id: "colonne-frigo-60",
    label: "Colonne réfrigérateur 60",
    slot: "colonne",
    widthMm: 600,
    depthMm: 600,
    heightMm: 2100,
    fixture: "fridge",
    priceCents: 61000,
  },
  {
    id: "colonne-rangement-60",
    label: "Colonne de rangement 60",
    slot: "colonne",
    widthMm: 600,
    depthMm: 600,
    heightMm: 2100,
    fixture: null,
    priceCents: 44000,
  },
];

const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function moduleById(id: string): KitchenModule | undefined {
  return BY_ID.get(id);
}

export function modulesForSlot(slot: Slot): KitchenModule[] {
  return MODULES.filter((m) => m.slot === slot);
}

/** Metres, for the renderer and the fit maths. */
export const mm = (v: number) => v / 1000;
