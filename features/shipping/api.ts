import { apiClient } from "../../lib/api";
import type { ShippingZone } from "../../lib/types";

export interface ShippingOption {
  territory: ShippingZone;
  delay: string;
  fee: number; // euros
}

/** Public shipping fee + delay per territory, from the server. */
export const getShippingOptionsApi = async (): Promise<ShippingOption[]> => {
  const { data } = await apiClient.get<ShippingOption[]>("/shipping/options");
  return data;
};
