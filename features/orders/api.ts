import { apiClient } from "../../lib/api";
import type { Order } from "../../lib/types";
import type { TrackingInfo } from "./types";

export const getOrdersApi = async (): Promise<Order[]> => {
  const { data } = await apiClient.get<Order[]>("/orders");
  return data;
};

export const getOrderByIdApi = async (orderId: string): Promise<Order> => {
  const { data } = await apiClient.get<Order>(`/orders/${orderId}`);
  return data;
};

export const createOrderApi = async (payload: {
  items: {
    productId: string;
    quantity: number;
    customDimensions?: { width: number; height: number };
    openingType?: string;
  }[];
  shippingAddressId: string;
  shippingMethod: string;
  territory: string;
  customerNote?: string;
  customerAttachments?: { url: string; type: "image" | "video" }[];
}): Promise<Order> => {
  const { data } = await apiClient.post<Order>("/orders", payload);
  return data;
};

export const cancelOrderApi = async (orderId: string): Promise<void> => {
  await apiClient.post(`/orders/${orderId}/cancel`);
};

export const trackOrderApi = async (
  orderId: string,
): Promise<TrackingInfo> => {
  const { data } = await apiClient.get<TrackingInfo>(
    `/orders/${orderId}/tracking`,
  );
  return data;
};
