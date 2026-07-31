import { getProductImage } from "./mock-data";

/** Minimal shape needed to pick a cover image (Product and its lighter DTOs). */
type CoverSource = {
  images?: string[] | null;
  colors?: { images?: string[] | null }[] | null;
};

/**
 * URL of the image that represents a product in lists and cards.
 *
 * The admin can publish a product whose only gallery media is a video and put
 * the photos on colour variants instead — in that case `images` is empty, so we
 * fall back to the first colour that carries an image.
 */
export function productCoverUri(product?: CoverSource | null): string | undefined {
  if (!product) return undefined;
  const own = product.images?.find((url) => !!url);
  if (own) return own;
  return product.colors?.find((c) => c.images?.some((url) => !!url))?.images?.[0];
}

/** Image source for a product card, or null when the product has no photo. */
export function productCoverSource(product?: CoverSource | null) {
  return getProductImage(productCoverUri(product));
}
