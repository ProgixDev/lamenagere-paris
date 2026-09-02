-- ============================================================================
-- Defer order creation until payment succeeds.
--
-- Until now `POST /orders` inserted a real `orders` row (payment_status
-- defaulting to 'unpaid') before the Stripe PaymentIntent even existed. If the
-- customer backed out of the Payment Sheet — or the app was killed — that row
-- was never cleaned up: it sat forever, visible in the admin dashboard's order
-- list (which has no payment_status filter), indistinguishable from a real
-- order, and every retry created another one.
--
-- order_drafts stages the priced cart + a Stripe PaymentIntent until payment
-- actually succeeds; only then does OrdersService.finalizeDraft() create a
-- real `orders` row, already payment_status = 'paid'. Modelled on
-- stripe_webhook_events: service-role only, no client ever reads a draft.
-- ============================================================================

CREATE TABLE order_drafts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id               uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_b2b                   boolean NOT NULL DEFAULT false,
  -- The would-be CreateOrderDto's server-computed pricing, frozen at
  -- create-intent time. finalizeDraft() replays this snapshot verbatim rather
  -- than re-pricing, so order.total_cents always matches what Stripe actually
  -- charged.
  payload                  jsonb NOT NULL,
  stripe_payment_intent_id text,
  -- The finalize lock: `UPDATE order_drafts SET claimed_at = now() WHERE id =
  -- $1 AND claimed_at IS NULL` lets the client's own confirm call and the
  -- webhook backstop race safely for who gets to build the order.
  claimed_at               timestamptz,
  order_id                 uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_drafts_profile ON order_drafts(profile_id);
CREATE INDEX idx_order_drafts_intent  ON order_drafts(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Service-role only, same as stripe_webhook_events: no client reads a draft
-- directly, and it is never surfaced to the admin dashboard.
ALTER TABLE order_drafts ENABLE ROW LEVEL SECURITY;

-- Makes promo.service.ts#recordRedemption idempotent: a webhook retry racing
-- the client's confirm-draft call can no longer double-count a redemption for
-- the same order.
ALTER TABLE promo_redemptions
  ADD CONSTRAINT promo_redemptions_order_id_key UNIQUE (order_id);
