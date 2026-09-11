import type { Category, ConfigBlock, ConfigBlockField, Product } from "./types";
import { areaFormula } from "./area-formulas";

/**
 * One screen of the guided flow. The back office decides which modules exist;
 * the sequence below is fixed here so a manager reordering blocks can never ask
 * for the gamme before the shape.
 *
 * Forme → Mesures → Îlot → Gamme → Couleurs → Accessoires → Récapitulatif
 */
/** Reserved id of the synthetic entry that carries the product's own colour. */
export const PRODUCT_COLOR_BLOCK_ID = "product-color";

export type Step =
  | { kind: "shape"; block: ConfigBlock }
  | { kind: "productColor" }
  | { kind: "measures"; block: ConfigBlock }
  | { kind: "dims" }
  | { kind: "ilot"; block: ConfigBlock }
  | { kind: "tiers" }
  | { kind: "colors"; block: ConfigBlock }
  | { kind: "extras"; blocks: ConfigBlock[] }
  | { kind: "summary" };

/** How many runs each shape bills. Unknown shapes bill everything filled in. */
export function runsOfShape(block: ConfigBlock | undefined, shapeKey?: string): number {
  const opt = (block?.options ?? []).find((o) => o.key === shapeKey);
  return opt?.runs ?? 0;
}

const RUN_ROLES = ["run1", "run2", "run3"] as const;

/**
 * The worktop height along the runs, which the customer is never asked for.
 *
 * A kitchen is built to a standard worktop, and asking the customer for it
 * invites a wrong answer to a decision the workshop makes anyway. It is still
 * recorded — the island opens on it, and an island can be billed on it — it is
 * simply not asked.
 */
export const FIXED_HEIGHTS_CM = { worktop: 90 } as const;

/**
 * The island's own height, which the customer *is* asked for once they take an
 * island.
 *
 * It opens on the worktop height, because an island that matches the runs is
 * what most kitchens want and nothing should drift by accident. But a
 * breakfast bar is a real thing a customer orders, so once the island is in
 * the configuration they can raise it — and the studio then draws it at that
 * height, stools included, rather than pretending it matches.
 */
export const ILOT_HEIGHT_CM = {
  default: FIXED_HEIGHTS_CM.worktop,
  min: 70,
  max: 120,
} as const;

/**
 * The wall height, which the customer *is* asked for.
 *
 * It is the cote the per-m² price is multiplied by, so it is worth asking:
 * pricing a 2,50 m room as if it were 2,10 m undercharges the kitchen by a
 * fifth. It arrives pre-filled at the standard 2,10 m so a customer who does
 * not know their ceiling still gets a price, and moves between bounds rather
 * than freely — `min` is the floor of a habitable room, and without it the
 * ruler would start at 0 and let someone bill a full kitchen at 40 cm.
 *
 * `min`/`max` are defaults: a back office that sets its own bounds on the
 * field wins, since it knows the model it is selling.
 */
export const WALL_HEIGHT_CM = { default: 210, min: 180, max: 300 } as const;

/** Accent- and case-insensitive, matching the loose labels the back office uses. */
const norm = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Whether a measurement is one the customer never sees.
 *
 * One field only: the worktop height along the runs, which the workshop
 * decides. The block matters, not just the field — the two other heights a
 * kitchen carries are both questions the customer answers, the wall on the
 * measurements block (`isWallHeight`) and the island's own on the îlot block
 * (`isIlotHeight`).
 *
 * Still seeded into `configState` after being hidden, never dropped: it is
 * what the island opens on and what the recap prints, and an island billed on
 * a per-m² formula that multiplies by a height bills nothing at all when that
 * height is missing.
 */
export function hiddenHeight(
  field: ConfigBlockField,
  blockType: string | undefined,
  isKitchen: boolean,
): "worktop" | null {
  // Kitchens only, and `isKitchen` is required rather than defaulted so the
  // compiler makes every call site answer the question. Outside a kitchen there
  // is no ceiling and no worktop, so nothing here applies: a `height` role is
  // just a measurement the customer is asked for like any other. CANAPÉ MONACO
  // tags its "Profondeur" that way — hiding it silently billed the sofa at
  // 2,10 m deep, which is where this guard comes from.
  if (!isKitchen) return null;
  if (blockType === "ilot") return null;
  return norm(field.label).includes("plan de travail") ? "worktop" : null;
}

/**
 * Whether this field is the kitchen's wall height — the one measurement that
 * multiplies every run, and so the one the price is most sensitive to.
 *
 * Kitchens only, and the measurements block only. A `height` role elsewhere is
 * an ordinary measurement: the îlot's is the island worktop (hidden above),
 * and outside a kitchen there is no ceiling at all — CANAPÉ MONACO tags its
 * "Profondeur" that way, and it must keep its own bounds.
 */
export function isWallHeight(
  field: ConfigBlockField,
  blockType: string | undefined,
  isKitchen: boolean,
): boolean {
  return isKitchen && blockType === "measurements" && field.priceRole === "height";
}

/**
 * Whether this field is the island's height.
 *
 * Tagged or simply named: the live blocks leave the îlot's fields untagged —
 * nothing on that block feeds the product's own surface — so the label is what
 * identifies it, exactly as the length and the width are identified in
 * `kitchenConfigFrom`.
 */
export function isIlotHeight(
  field: ConfigBlockField,
  blockType: string | undefined,
  isKitchen: boolean,
): boolean {
  if (!isKitchen || blockType !== "ilot") return false;
  return field.priceRole === "height" || norm(field.label).startsWith("hauteur");
}

/**
 * The value a height opens on when the customer has not answered it yet.
 *
 * `null` for every other measurement: a length is asked for empty, and a ruler
 * that arrives pre-filled at a plausible number is a number the customer never
 * checks. Only the heights get one, because each has a standard that is right
 * far more often than not.
 */
export function seededHeightCm(
  field: ConfigBlockField,
  blockType: string | undefined,
  isKitchen: boolean,
): number | null {
  const hidden = hiddenHeight(field, blockType, isKitchen);
  if (hidden) return FIXED_HEIGHTS_CM[hidden];
  if (isWallHeight(field, blockType, isKitchen)) return WALL_HEIGHT_CM.default;
  if (isIlotHeight(field, blockType, isKitchen)) return ILOT_HEIGHT_CM.default;
  return null;
}

/**
 * The bounds a measurement's ruler moves between.
 *
 * Whatever the back office set, except that the two heights the customer
 * answers fall back to something buildable rather than to the ruler's own
 * 0–1000. The wall height is the cote the m² price is multiplied by and the
 * live blocks give it a max but no min; the island's decides a worktop nobody
 * can cook on at 30 cm.
 */
export function measureBoundsCm(
  field: ConfigBlockField,
  blockType: string | undefined,
  isKitchen: boolean,
): { min?: number; max?: number } {
  const fallback = isWallHeight(field, blockType, isKitchen)
    ? WALL_HEIGHT_CM
    : isIlotHeight(field, blockType, isKitchen)
      ? ILOT_HEIGHT_CM
      : null;
  if (!fallback) return { min: field.min, max: field.max };
  return { min: field.min ?? fallback.min, max: field.max ?? fallback.max };
}

/**
 * The measurements actually worth asking for, given the shape.
 *
 * A straight kitchen has one wall, so asking for the second and third run is
 * noise the customer has to ignore — and filling them in would bill walls that
 * don't exist. The wall height and any untagged field are always asked; run
 * fields appear as the shape earns them.
 */
export function visibleFields(
  block: ConfigBlock,
  opts: { byShape: boolean; runs: number; isKitchen: boolean },
): ConfigBlockField[] {
  // The fixed heights are filtered first, so they vanish from the mesures step,
  // the îlot step, the studio panel and the "have you filled this in" check
  // alike.
  const fields = (block.fields ?? []).filter(
    (f) => !hiddenHeight(f, block.type, opts.isKitchen),
  );
  // The island is asked for height first, so both measurement steps open on
  // the same question — the mesures block already leads with the wall height.
  // Ordering only, and only here: the back office keeps its own order for
  // everything else, and nothing downstream reads these by position.
  const height = fields.findIndex((f) => isIlotHeight(f, block.type, opts.isKitchen));
  if (height > 0) fields.unshift(...fields.splice(height, 1));
  if (!opts.byShape) return fields;
  return fields.filter((f) => {
    const idx = RUN_ROLES.indexOf(f.priceRole as (typeof RUN_ROLES)[number]);
    return idx === -1 || idx < opts.runs;
  });
}

export function buildSteps(
  product: Product,
  blocks: ConfigBlock[],
  opts: { byShape: boolean; needsDims: boolean },
): Step[] {
  const steps: Step[] = [];
  const of = (t: string) => blocks.filter((b) => b.type === t);

  for (const b of of("shape")) steps.push({ kind: "shape", block: b });
  for (const b of of("measurements")) steps.push({ kind: "measures", block: b });
  if (opts.needsDims && areaFormula(product.areaFormula).fields.length) {
    steps.push({ kind: "dims" });
  }
  for (const b of of("ilot")) steps.push({ kind: "ilot", block: b });
  if ((product.qualityTiers ?? []).length) steps.push({ kind: "tiers" });
  // The product's own colourway, photographed under "Médias & couleurs". It is
  // a different decision from the colour of the accessories that come with it,
  // which the `colors` blocks below cover.
  if ((product.colors ?? []).length) steps.push({ kind: "productColor" });
  for (const b of of("colors")) steps.push({ kind: "colors", block: b });

  // Everything else lands in a single "options" screen rather than one step per
  // accessory list, which would run to a dozen taps on a kitchen.
  const extras = blocks.filter(
    (b) => !["shape", "measurements", "ilot", "colors"].includes(b.type),
  );
  if (extras.length) steps.push({ kind: "extras", blocks: extras });

  // A 3D step used to come last, after the shape and the measurements it drew
  // from. The studio is gone — renderer, catalogue and all — and with it the
  // synthetic `layout` entry that carried an implantation to the workshop. The
  // customer answers the same questions; nothing draws them a kitchen.
  //
  // Orders placed before the removal keep their implantation: `ConfiguredLayout`
  // and the recap's `e.layout` branch are still there to render them.

  steps.push({ kind: "summary" });
  return steps;
}

/**
 * Whether a category is kitchens — the one place the app is allowed to assume a
 * ceiling, a worktop and a run of cabinets. Gates the heights the customer is
 * never asked for.
 *
 * Matched on the name and the slug both, accent- and case-insensitively, so
 * "Cuisines", "cuisines", "Cuisine équipée" and a "cuisines-sur-mesure"
 * sub-category all count. Kept loose on purpose: the back office renames
 * categories freely, and an id list here would silently drop the behaviour the
 * first time someone created a second kitchen category.
 */
export function isKitchenCategory(category: Category | undefined): boolean {
  if (!category) return false;
  return norm(category.name).includes("cuisine") || norm(category.slug).includes("cuisine");
}

/** Screen title + one-line subtitle, so every step reads as a single question. */
export function stepCopy(step: Step): { title: string; subtitle: string } {
  switch (step.kind) {
    case "shape":
      return { title: step.block.label || "La forme", subtitle: "Choisissez l'implantation qui correspond à votre pièce." };
    case "measures":
      return { title: step.block.label || "Vos mesures", subtitle: "Le schéma s'allume sur la cote que vous saisissez." };
    case "dims":
      return { title: "Vos dimensions", subtitle: "Indiquez les dimensions souhaitées." };
    case "ilot":
      return { title: step.block.label || "Îlot", subtitle: "Souhaitez-vous un îlot central ?" };
    case "tiers":
      return { title: "La gamme", subtitle: "Le niveau de finition décide du prix au m²." };
    case "productColor":
      return { title: "Le coloris", subtitle: "Votre produit, photographié dans chaque finition." };
    case "colors":
      return { title: step.block.label || "La couleur", subtitle: "L'aperçu se met à jour à chaque choix." };
    case "extras":
      return { title: "Vos options", subtitle: "Accessoires, équipements et finitions." };
    case "summary":
      return { title: "Récapitulatif", subtitle: "Vérifiez votre configuration avant de l'ajouter au panier." };
  }
}
