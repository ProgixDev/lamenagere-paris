-- ============================================================================
-- Iteration 15: refunds — customer-initiated refund requests + admin decision.
-- A customer can request a refund on a paid order; an admin accepts (issuing a
-- real Stripe refund) or rejects it. Refund lifecycle is tracked separately
-- from the fulfillment status (order_status) and payment_status.
-- ============================================================================

-- refund_status values: 'none' | 'requested' | 'refunded' | 'rejected'.
ALTER TABLE orders
  ADD COLUMN refund_status text NOT NULL DEFAULT 'none';
ALTER TABLE orders
  ADD COLUMN refund_reason text;             -- customer's stated reason
ALTER TABLE orders
  ADD COLUMN refund_decision_note text;      -- admin's note (esp. on reject)
ALTER TABLE orders
  ADD COLUMN refund_requested_at timestamptz;
ALTER TABLE orders
  ADD COLUMN refund_decided_at timestamptz;
ALTER TABLE orders
  ADD COLUMN refund_amount_cents integer;    -- amount actually refunded
ALTER TABLE orders
  ADD COLUMN stripe_refund_id text;          -- Stripe refund id (idempotency)

CREATE INDEX idx_orders_refund_status ON orders(refund_status)
  WHERE refund_status <> 'none';
