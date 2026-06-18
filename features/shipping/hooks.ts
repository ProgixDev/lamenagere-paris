import { useQuery } from "@tanstack/react-query";
import { getShippingOptionsApi } from "./api";

export const useShippingOptions = () =>
  useQuery({
    queryKey: ["shipping", "options"],
    queryFn: getShippingOptionsApi,
    staleTime: 30 * 60 * 1000,
  });
