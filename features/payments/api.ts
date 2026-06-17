import { apiClient } from "../../lib/api";

export const createPaymentIntentApi = async (
  orderId: string,
): Promise<{ clientSecret: string }> => {
  const { data } = await apiClient.post<{ clientSecret: string }>(
    "/payments/create-intent",
    { orderId },
  );
  return data;
};
