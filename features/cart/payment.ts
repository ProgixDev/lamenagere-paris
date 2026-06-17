import type { CartItem } from "../../lib/types";

export type PaymentInput = {
  items: CartItem[];
  amountCents: number;
  currency: "eur";
  email?: string;
  shippingAddressId?: string;
  shippingMethod?: string;
};

export type PaymentResult =
  | { ok: true; paymentIntentId: string }
  | { ok: false; error: string };

// TODO(stripe): implement real payment here.
//   1. POST /payments/create-intent -> { clientSecret }
//   2. presentPaymentSheet({ clientSecret })
//   3. return the confirmed paymentIntentId
// The checkout flow currently creates the order directly via createOrderApi
// (treated as pending payment) and does NOT call this helper. It is kept as the
// designated insertion point for the Stripe integration.
export async function processPayment(
  _input: PaymentInput,
): Promise<PaymentResult> {
  throw new Error("Stripe payment not implemented yet");
}
