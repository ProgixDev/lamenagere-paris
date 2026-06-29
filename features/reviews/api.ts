import { apiClient } from "../../lib/api";
import type { ProductReview } from "../../lib/types";

export interface CreateReviewPayload {
  productId: string;
  orderItemId: string;
  rating: number;
  comment?: string;
}

export const createReviewApi = async (
  payload: CreateReviewPayload,
): Promise<ProductReview> => {
  const { data } = await apiClient.post<ProductReview>("/reviews", payload);
  return data;
};

export const getProductReviewsApi = async (
  productId: string,
): Promise<ProductReview[]> => {
  const { data } = await apiClient.get<ProductReview[]>(
    `/products/${productId}/reviews`,
  );
  return data;
};
