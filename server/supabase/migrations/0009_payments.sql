-- ============================================================================
-- Iteration 9: payments — Stripe PaymentIntent tracking on orders.
-- ============================================================================

-- payment_status values: 'unpaid' | 'paid' | 'failed' | 'refunded'.
ALTER TABLE orders
  ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders
  ADD COLUMN stripe_payment_intent_id text;
