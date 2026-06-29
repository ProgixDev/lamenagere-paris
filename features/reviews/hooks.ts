import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createReviewApi,
  getProductReviewsApi,
  type CreateReviewPayload,
} from "./api";

export const useProductReviews = (productId: string) =>
  useQuery({
    queryKey: ["productReviews", productId],
    queryFn: () => getProductReviewsApi(productId),
    enabled: !!productId,
    staleTime: 60 * 1000,
  });

export const useCreateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReviewPayload) => createReviewApi(payload),
    onSuccess: (_review, payload) => {
      queryClient.invalidateQueries({ queryKey: ["productReviews", payload.productId] });
      queryClient.invalidateQueries({ queryKey: ["product", payload.productId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};
