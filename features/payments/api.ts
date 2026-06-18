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

// Called right after the Payment Sheet reports success so the server can
// re-verify the PaymentIntent with Stripe and mark the order paid immediately
// (the webhook is the backstop for edge cases).
export const confirmPaymentApi = async (
  orderId: string,
): Promise<{ status: "paid" | "pending" | "failed" }> => {
  const { data } = await apiClient.post<{
    status: "paid" | "pending" | "failed";
  }>("/payments/confirm", { orderId });
  return data;
};
