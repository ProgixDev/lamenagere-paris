import type { Product } from "./types";

/** Ceiling for a quantity stepper when neither stock nor a cap is set. */
export const MAX_QTY = 9999;

/**
 * How many units of a product one order may hold. Two limits bound it and the
 * lower one wins — what's left in stock, and the per-order cap set in the back
 * office. Products that track neither stop at {@link MAX_QTY}.
 *
 * Never returns 0: out-of-stock is a separate state (see {@link isOutOfStock})
 * so the stepper stays readable while the CTA is what turns off.
 */
export function maxOrderableQty(product: Product): number {
  return Math.max(
    1,
    Math.min(product.stockQty ?? MAX_QTY, product.maxPerOrder ?? MAX_QTY),
  );
}

/** True when there's nothing left to sell. Untracked products are never out. */
export function isOutOfStock(product: Product): boolean {
  return product.stock === "rupture" || product.stockQty === 0;
}
