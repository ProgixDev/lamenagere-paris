import { apiClient } from "../../lib/api";

export interface PromoLineItemInput {
  productId?: string;
  lineTotalCents: number;
}

export interface PromoPreview {
  valid: boolean;
  message?: string;
  code?: string;
  discountType?: "percent" | "fixed";
  discountValue?: number;
  /** Discount applied to the eligible subtotal, in cents. */
  discountCents?: number;
}

/**
 * Checkout-time preview of a promo code against the current cart. Never throws
 * on an invalid code — the server returns { valid:false, message }. The final
 * discount is recomputed authoritatively when the order is created.
 */
export const validatePromoApi = async (
  code: string,
  items: PromoLineItemInput[],
): Promise<PromoPreview> => {
  const { data } = await apiClient.post<PromoPreview>("/promo-codes/validate", {
    code,
    items,
  });
  return data;
};
