-- ── Promo codes ─────────────────────────────────────────────────────────────
-- Admin-managed discount codes applied at checkout. A code is either global
-- (product_id NULL → discounts the whole cart subtotal) or scoped to a single
-- product (discounts only that product's line total). Usage is bounded by an
-- optional global cap (max_redemptions) and an optional per-customer cap
-- (per_customer_limit); every redemption is logged in promo_redemptions so the
-- per-customer count can be enforced. All access is service-role only (RLS on,
-- no policies): the API validates and applies codes server-side.

CREATE TYPE promo_discount_type AS ENUM ('percent', 'fixed');

CREATE TABLE promo_codes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE,            -- stored upper-cased
  description        text,
  discount_type      promo_discount_type NOT NULL,
  discount_value     integer NOT NULL,                -- percent 1-100, or fixed cents
  product_id         uuid REFERENCES products(id) ON DELETE CASCADE, -- NULL = global
  min_order_cents    integer,                         -- min cart subtotal to qualify
  max_redemptions    integer,                         -- NULL = unlimited (global)
  per_customer_limit integer,                         -- NULL = unlimited per customer
  times_redeemed     integer NOT NULL DEFAULT 0,
  starts_at          timestamptz,
  expires_at         timestamptz,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_discount_value_positive CHECK (discount_value > 0),
  CONSTRAINT promo_percent_range CHECK (
    discount_type <> 'percent' OR discount_value <= 100
  )
);
CREATE INDEX idx_promo_codes_active ON promo_codes(is_active);
CREATE TRIGGER trg_promo_codes_updated BEFORE UPDATE ON promo_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE promo_redemptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id  uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  profile_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id       uuid REFERENCES orders(id) ON DELETE SET NULL,
  discount_cents integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_redemptions_customer
  ON promo_redemptions(promo_code_id, profile_id);

ALTER TABLE promo_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Discount snapshot on the order (charge = subtotal - discount + shipping).
ALTER TABLE orders
  ADD COLUMN promo_code     text,
  ADD COLUMN promo_code_id  uuid REFERENCES promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN discount_cents integer NOT NULL DEFAULT 0;
