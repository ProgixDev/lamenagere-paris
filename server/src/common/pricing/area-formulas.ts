/**
 * Area formulas for per_sqm products.
 *
 * A per-m² product is billed on a surface, but "surface" doesn't mean the same
 * thing for every product: a tiled floor is measured flat (largeur × longueur),
 * a glazed bay is measured as a facade (largeur × hauteur), and a fitted kitchen
 * wraps around a corner, so its billable surface is the *developed* run — every
 * wall segment laid end to end, times the height.
 *
 * Each product picks one formula; the formula declares which dimensions the
 * customer is asked for, so the app renders the right inputs and the server
 * prices exactly what was shown.
 *
 * This module is mirrored in the mobile app at `lib/area-formulas.ts`. Keep the
 * two in sync — the app's live preview must match the price resolved here.
 */

export type AreaFormulaKey =
  | 'width_height'
  | 'width_length'
  | 'l_shape'
  | 'u_shape'
  | 'by_shape';

export type AreaDimensionKey =
  | 'width'
  | 'height'
  | 'length'
  | 'left'
  | 'back'
  | 'right';

/**
 * Customer-entered dimensions, in centimetres. Every field is optional: which
 * ones are required is decided by the product's formula, not by this type.
 */
export interface AreaDimensions {
  width?: number;
  height?: number;
  length?: number;
  left?: number;
  back?: number;
  right?: number;
}

export interface AreaFormulaField {
  key: AreaDimensionKey;
  /** Input label shown to the customer. */
  label: string;
  /** Compact label for recap lines, e.g. "L 300 · Lo 200 · H 240 cm". */
  short: string;
  /** Used inside validation messages, e.g. "la largeur doit être…". */
  errorLabel: string;
  /**
   * Horizontal dims share the product's min/max width bounds; the vertical one
   * uses its min/max height bounds. Keeps bounds to two pairs of columns
   * instead of one pair per dimension.
   */
  axis: 'horizontal' | 'vertical';
}

export interface AreaFormulaDef {
  key: AreaFormulaKey;
  /** Short name for the back office. */
  label: string;
  /** The maths, written out for the admin choosing a formula. */
  expression: string;
  /** Which products this formula is for. */
  hint: string;
  fields: AreaFormulaField[];
  /** Billable surface in m², from centimetre inputs. */
  areaM2(dims: AreaDimensions): number;
}

const WIDTH: AreaFormulaField = {
  key: 'width',
  label: 'Largeur',
  short: 'L',
  errorLabel: 'la largeur',
  axis: 'horizontal',
};
const HEIGHT: AreaFormulaField = {
  key: 'height',
  label: 'Hauteur',
  short: 'H',
  errorLabel: 'la hauteur',
  axis: 'vertical',
};
const LENGTH: AreaFormulaField = {
  key: 'length',
  label: 'Longueur',
  short: 'Lo',
  errorLabel: 'la longueur',
  axis: 'horizontal',
};
const LEFT: AreaFormulaField = {
  key: 'left',
  label: 'Longueur gauche',
  short: 'G',
  errorLabel: 'la longueur gauche',
  axis: 'horizontal',
};
const BACK: AreaFormulaField = {
  key: 'back',
  label: 'Longueur du fond',
  short: 'F',
  errorLabel: 'la longueur du fond',
  axis: 'horizontal',
};
const RIGHT: AreaFormulaField = {
  key: 'right',
  label: 'Longueur droite',
  short: 'D',
  errorLabel: 'la longueur droite',
  axis: 'horizontal',
};

/** cm² -> m². */
const toM2 = (cm2: number): number => cm2 / 10000;

const n = (v?: number): number => (Number.isFinite(v) ? (v as number) : 0);

export const AREA_FORMULAS: Record<AreaFormulaKey, AreaFormulaDef> = {
  width_height: {
    key: 'width_height',
    label: 'Largeur × Hauteur',
    expression: 'Largeur × Hauteur',
    hint: 'Surface verticale : vitrages, portes, façades, verrières.',
    fields: [WIDTH, HEIGHT],
    areaM2: (d) => toM2(n(d.width) * n(d.height)),
  },
  width_length: {
    key: 'width_length',
    label: 'Largeur × Longueur (au sol)',
    expression: 'Largeur × Longueur',
    hint: 'Surface au sol : carreaux, dalles, parquet, moquette.',
    fields: [WIDTH, LENGTH],
    areaM2: (d) => toM2(n(d.width) * n(d.length)),
  },
  l_shape: {
    key: 'l_shape',
    label: '(Largeur + Longueur) × Hauteur — en L',
    expression: '(Largeur + Longueur) × Hauteur',
    hint: 'Deux pans qui se rejoignent en angle : cuisine en L, meuble d’angle, canapé d’angle.',
    fields: [WIDTH, LENGTH, HEIGHT],
    areaM2: (d) => toM2((n(d.width) + n(d.length)) * n(d.height)),
  },
  by_shape: {
    key: 'by_shape',
    label: 'Pilotée par la forme choisie (I / L / U)',
    expression: '(somme des pans facturés) × Hauteur',
    hint: "Le client choisit la forme et saisit ses mesures dans les blocs de configuration ; la forme décide combien de pans sont facturés. Aucune saisie en double.",
    // No fields of its own: the numbers come from the configuration blocks.
    fields: [],
    areaM2: (d) => toM2(n(d.width) * n(d.height)),
  },
  u_shape: {
    key: 'u_shape',
    label: '(Gauche + Fond + Droite) × Hauteur — en U',
    expression: '(Longueur gauche + Longueur du fond + Longueur droite) × Hauteur',
    hint: 'Trois pans qui se rejoignent : cuisine en U, dressing en U.',
    fields: [LEFT, BACK, RIGHT, HEIGHT],
    areaM2: (d) => toM2((n(d.left) + n(d.back) + n(d.right)) * n(d.height)),
  },
};

export const AREA_FORMULA_KEYS = Object.keys(AREA_FORMULAS) as AreaFormulaKey[];

export const DEFAULT_AREA_FORMULA: AreaFormulaKey = 'width_height';

/**
 * Resolves a formula, falling back to the historical width × height for null,
 * legacy, or unrecognised values so an unknown key can never break checkout.
 */
export function areaFormula(key?: AreaFormulaKey | string | null): AreaFormulaDef {
  if (key && key in AREA_FORMULAS) {
    return AREA_FORMULAS[key as AreaFormulaKey];
  }
  return AREA_FORMULAS[DEFAULT_AREA_FORMULA];
}

/**
 * Compact recap of the dimensions a formula actually bills, e.g.
 * "L 300 · Lo 200 · H 240 cm". Dimensions the formula ignores are left out, so
 * a recap never shows a number that didn't affect the price.
 */
export function formatAreaDimensions(
  key: AreaFormulaKey | string | null | undefined,
  dims: AreaDimensions,
): string {
  const parts = areaFormula(key)
    .fields.map((f) => {
      const value = dims[f.key];
      return value == null ? null : `${f.short} ${value}`;
    })
    .filter((p): p is string => p != null);
  return parts.length ? `${parts.join(' · ')} cm` : '';
}

/**
 * Formats whichever dimensions were actually recorded, without needing to know
 * the formula that produced them. Used where only an order line is available
 * (back office, order history) — a line only ever stores the dimensions its
 * formula billed, so the result is exactly what the customer was charged on.
 */
const RECAP_ORDER: AreaDimensionKey[] = [
  'width',
  'length',
  'left',
  'back',
  'right',
  'height',
];

export function formatEnteredDimensions(dims: AreaDimensions): string {
  const byKey = new Map<AreaDimensionKey, AreaFormulaField>();
  for (const def of Object.values(AREA_FORMULAS)) {
    for (const f of def.fields) byKey.set(f.key, f);
  }
  const parts = RECAP_ORDER.map((key) => {
    const value = dims[key];
    return value == null ? null : `${byKey.get(key)?.short ?? key} ${value}`;
  }).filter((p): p is string => p != null);
  return parts.length ? `${parts.join(' · ')} cm` : '';
}

/**
 * Roles a measurement field can play in the price of a shape-driven product.
 * The back office tags the fields that matter; everything else stays purely
 * informational (a worktop height is recorded for the workshop, not billed).
 */
export type DimensionRole = 'height' | 'run1' | 'run2' | 'run3';

export const DIMENSION_ROLES: { key: DimensionRole; label: string }[] = [
  { key: 'height', label: 'Hauteur (multiplie les pans)' },
  { key: 'run1', label: 'Pan 1' },
  { key: 'run2', label: 'Pan 2' },
  { key: 'run3', label: 'Pan 3' },
];

const RUN_ROLES: DimensionRole[] = ['run1', 'run2', 'run3'];

/** Structural shapes, so this works against both the server and app types. */
export interface ShapePricingField {
  key: string;
  priceRole?: DimensionRole | null;
}
export interface ShapePricingOption {
  key: string;
  /** How many pans this shape bills: I = 1, L = 2, U = 3. */
  runs?: number | null;
}
export interface ShapePricingBlock {
  type: string;
  fields?: ShapePricingField[] | null;
  options?: ShapePricingOption[] | null;
}

/**
 * Derives the billable dimensions of a shape-driven product from what the
 * customer already filled in: the shape they picked decides how many pans are
 * billed, and the tagged measurement fields supply the numbers.
 *
 * Returns width = sum of the billed pans, height = the tagged height, so the
 * result feeds the ordinary width x height area used by `by_shape`.
 */
export function dimensionsFromShape(
  blocks: ShapePricingBlock[] | null | undefined,
  measurements: Record<string, number>,
  shapeKey?: string | null,
): AreaDimensions {
  const byRole = new Map<DimensionRole, number>();
  let runs = 0;

  for (const block of blocks ?? []) {
    if (block.type === 'measurements') {
      for (const field of block.fields ?? []) {
        const role = field.priceRole;
        const value = measurements[field.key];
        if (role && Number.isFinite(value)) byRole.set(role, value);
      }
    }
    if (block.type === 'shape' && shapeKey) {
      const option = (block.options ?? []).find((o) => o.key === shapeKey);
      if (option?.runs != null) runs = option.runs;
    }
  }

  // No shape chosen (or none configured) bills every pan that was filled in,
  // so a product with measurements but no shape block still prices.
  const billed = runs > 0 ? RUN_ROLES.slice(0, runs) : RUN_ROLES;
  const width = billed.reduce((sum, role) => sum + (byRole.get(role) ?? 0), 0);

  return { width, height: byRole.get('height') ?? 0 };
}
