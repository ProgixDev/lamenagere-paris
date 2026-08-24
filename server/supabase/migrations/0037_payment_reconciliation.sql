-- ============================================================================
-- Iteration 37: trustworthy money state — refund settlement, disputes, and an
-- idempotency ledger for Stripe webhooks.
--
-- Until now the only thing reconciled from Stripe was payment_status, from two
-- events (payment_intent.succeeded / .payment_failed). Three ways for the books
-- to drift from reality were left open:
--
--   1. A refund issued from the Stripe dashboard instead of the back office
--      never reached the database — the order still read "payé".
--   2. `refunds.create` returning `pending` was recorded as a *finished*
--      refund. A card refund settles over days and can still fail; nothing
--      here could ever learn that it had.
--   3. A chargeback pulled the money back with no trace at all.
--
-- refund_status is deliberately NOT extended. The published mobile app indexes
-- a lookup table with it (`REFUND_BANNER[order.refundStatus].icon`), so a value
-- it doesn't know crashes the order screen — and that app can't be updated in
-- step with this migration. The finer Stripe truth therefore lands in columns
-- below that only the back office reads.
-- ============================================================================

-- ── Orders: what Stripe actually says about the money ───────────────────────
ALTER TABLE orders
  -- Charge behind the PaymentIntent. `charge.*` events (refunds, disputes)
  -- identify themselves by charge, so without this they can't be matched back
  -- to an order when the intent id isn't carried on the event.
  ADD COLUMN stripe_charge_id text,

  -- Running total refunded, taken from `charge.amount_refunded` — authoritative
  -- and cumulative, so several partial refunds can't double-count. Distinct
  -- from refund_amount_cents, which records the amount of the *last* refund we
  -- ourselves asked for.
  ADD COLUMN refunded_total_cents int NOT NULL DEFAULT 0
    CHECK (refunded_total_cents >= 0),

  -- Where the refund is with the bank, mirroring Stripe's Refund.status.
  --   none       no refund attempted
  --   pending    submitted, money not yet with the customer
  --   succeeded  settled
  --   failed     the bank rejected it — needs a human
  --   canceled   withdrawn before settling
  ADD COLUMN refund_settlement text NOT NULL DEFAULT 'none'
    CHECK (refund_settlement IN
      ('none', 'pending', 'succeeded', 'failed', 'canceled')),
  ADD COLUMN refund_failure_reason text,

  -- Chargebacks. dispute_status mirrors the outcome, not Stripe's full
  -- vocabulary: open covers every "still live" state.
  ADD COLUMN stripe_dispute_id text,
  ADD COLUMN dispute_status text NOT NULL DEFAULT 'none'
    CHECK (dispute_status IN ('none', 'open', 'won', 'lost')),
  ADD COLUMN dispute_reason text,
  ADD COLUMN dispute_amount_cents int,
  ADD COLUMN dispute_evidence_due_at timestamptz;

-- Webhooks arrive keyed by charge, refund or intent; each needs to find its
-- order in one hop.
CREATE INDEX IF NOT EXISTS orders_stripe_charge_id_idx
  ON orders (stripe_charge_id) WHERE stripe_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_idx
  ON orders (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_stripe_refund_id_idx
  ON orders (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;

-- Anything needing a human decision, in one place for the back office.
CREATE INDEX IF NOT EXISTS orders_needs_attention_idx
  ON orders (created_at DESC)
  WHERE refund_settlement = 'failed' OR dispute_status = 'open';

-- ── Idempotency ledger ──────────────────────────────────────────────────────
-- Stripe guarantees at-least-once delivery: the same event arrives again after
-- any non-2xx, a timeout, or a manual resend. Every handler below is written to
-- be replay-safe on its own, but money is not the place to rely on that alone —
-- the event id is claimed here first and a second delivery returns early.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id          text PRIMARY KEY,          -- Stripe's evt_… id
  type        text NOT NULL,
  order_id    uuid REFERENCES orders (id) ON DELETE SET NULL,
  outcome     text,                      -- what the handler decided, for audit
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_received_at_idx
  ON stripe_webhook_events (received_at DESC);

-- Server-side only: the service role bypasses RLS, and no client should ever
-- read this table.
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Orders already marked refunded settled long ago; recording them as such keeps
-- the new column honest instead of leaving them at 'none'.
UPDATE orders
   SET refund_settlement    = 'succeeded',
       refunded_total_cents = COALESCE(refund_amount_cents, total_cents)
 WHERE refund_status = 'refunded';
