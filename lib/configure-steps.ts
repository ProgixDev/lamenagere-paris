import type { ConfigBlock, ConfigBlockField, Product } from "./types";
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
 * The measurements actually worth asking for, given the shape.
 *
 * A straight kitchen has one wall, so asking for the second and third run is
 * noise the customer has to ignore — and filling them in would bill walls that
 * don't exist. Untagged fields (worktop height) and the wall height are always
 * asked; run fields appear as the shape earns them.
 */
export function visibleFields(
  block: ConfigBlock,
  opts: { byShape: boolean; runs: number },
): ConfigBlockField[] {
  const fields = block.fields ?? [];
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

  steps.push({ kind: "summary" });
  return steps;
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
