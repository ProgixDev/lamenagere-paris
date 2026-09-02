import { apiClient } from "../../lib/api";
import type { CreateOrderPayload } from "../orders/types";
import type { Order } from "../../lib/types";

// Prices the cart and creates a Stripe PaymentIntent for it WITHOUT creating
// an order — the cart is staged as a draft instead. Nothing is written to
// `orders` (and so nothing reaches the admin dashboard) until `confirmDraftApi`
// (or the webhook backstop) finalizes it after Stripe confirms the payment.
export const createIntentDraftApi = async (
  payload: CreateOrderPayload,
): Promise<{ clientSecret: string; draftId: string }> => {
  const { data } = await apiClient.post<{
    clientSecret: string;
    draftId: string;
  }>("/payments/create-intent-draft", payload);
  return data;
};

// Called right after the Payment Sheet reports success so the server can
// re-verify the PaymentIntent with Stripe and turn the draft into a real,
// paid order immediately (the webhook is the backstop for edge cases, e.g.
// the app being killed right after payment).
export const confirmDraftApi = async (
  draftId: string,
): Promise<{ status: "paid"; order: Order } | { status: "pending" }> => {
  const { data } = await apiClient.post<
    { status: "paid"; order: Order } | { status: "pending" }
  >("/payments/confirm-draft", { draftId });
  return data;
};

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
