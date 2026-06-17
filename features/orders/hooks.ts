import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrdersApi, getOrderByIdApi, cancelOrderApi } from "./api";

export const useOrders = () =>
  useQuery({
    queryKey: ["orders"],
    queryFn: getOrdersApi,
    staleTime: 60 * 1000,
  });

export const useOrder = (orderId: string) =>
  useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderByIdApi(orderId),
    enabled: !!orderId,
  });

export const useCancelOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => cancelOrderApi(orderId),
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });
};
