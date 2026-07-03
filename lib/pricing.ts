import type { Product } from "./types";
import { formatPrice } from "./utils";

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Short price label for cards / lists, where the customer hasn't entered
 * dimensions yet. Per-m² products advertise their €/m² rate; everything else
 * shows its (starting) price. Never returns "Sur devis" — quote products no
 * longer exist.
 */
export function priceTagLabel(product: Product): string {
  if (product.priceMode === "per_sqm") {
    // Tiered products advertise their cheapest tier as a starting price.
    if (product.qualityTiers?.length) {
      const min = Math.min(...product.qualityTiers.map((t) => t.pricePerSqm));
      return `dès ${formatPrice(min)}/m²`;
    }
    if (product.pricePerSqm != null) return `${formatPrice(product.pricePerSqm)}/m²`;
  }
  if (product.price != null) return formatPrice(product.price);
  if (product.pricePerSqm != null) return `${formatPrice(product.pricePerSqm)}/m²`;
  return formatPrice(0);
}

/**
 * Effective €/m² rate for a per_sqm product. When the product offers quality
 * tiers, the chosen tier's rate is used; otherwise the flat pricePerSqm. Returns
 * undefined when a tier is required but none (or an invalid one) is selected.
 */
export function perSqmRate(
  product: Product,
  qualityTier?: string,
): number | undefined {
  if (product.qualityTiers?.length) {
    if (!qualityTier) return undefined;
    return product.qualityTiers.find((t) => t.key === qualityTier)?.pricePerSqm;
  }
  return product.pricePerSqm;
}

/** Clamp a dimension to [min, max] when bounds are provided. */
function clamp(value: number, min?: number, max?: number): number {
  if (min != null && value < min) return min;
  if (max != null && value > max) return max;
  return value;
}

/** Surcharge (euros) for a chosen opening type on a product. */
export function openingSurcharge(
  product: Product,
  openingType?: string,
): number {
  if (!openingType || !product.openingTypes?.length) return 0;
  return product.openingTypes.find((o) => o.type === openingType)?.surcharge ?? 0;
}

/**
 * Display-only price (euros) for a configured product. Mirrors the server's
 * PricingService so the customer sees a live preview; the server re-resolves
 * the authoritative price at checkout.
 *
 * Returns `undefined` when the inputs needed for the product's price mode are
 * missing (e.g. per_sqm without dimensions), so callers can show a prompt.
 */
export function computeConfiguredPrice(
  product: Product,
  dims?: Dimensions | null,
  openingType?: string,
  qualityTier?: string,
): number | undefined {
  const surcharge = openingSurcharge(product, openingType);

  switch (product.priceMode) {
    case "fixed":
      return product.price != null ? product.price + surcharge : undefined;

    case "per_sqm": {
      const rate = perSqmRate(product, qualityTier);
      if (rate == null || !dims) return undefined;
      const w = clamp(
        dims.width,
        product.minDimensions?.width,
        product.maxDimensions?.width,
      );
      const h = clamp(
        dims.height,
        product.minDimensions?.height,
        product.maxDimensions?.height,
      );
      const areaM2 = (w / 100) * (h / 100);
      // Round to whole euros (matches server PricingService).
      const base = Math.max(0, Math.round(areaM2 * rate));
      return base + surcharge;
    }

    case "calculated":
      // Coefficients aren't exposed to the client; fall back to base + surcharge.
      return product.price != null ? product.price + surcharge : undefined;

    case "quote":
    default:
      return undefined;
  }
}
