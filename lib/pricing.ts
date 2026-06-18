import type { Product } from "./types";

export interface Dimensions {
  width: number;
  height: number;
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
): number | undefined {
  const surcharge = openingSurcharge(product, openingType);

  switch (product.priceMode) {
    case "fixed":
      return product.price != null ? product.price + surcharge : undefined;

    case "per_sqm": {
      if (product.pricePerSqm == null || !dims) return undefined;
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
      const base = Math.max(0, Math.round(areaM2 * product.pricePerSqm));
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
