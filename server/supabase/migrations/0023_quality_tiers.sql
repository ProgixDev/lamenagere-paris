-- ============================================================================
-- Iteration 23: quality tiers for per-m² pricing.
--
-- A per_sqm product can now offer several quality levels (e.g. Bas de gamme,
-- Milieu de gamme, Haute de gamme), each with its own €/m² rate. The customer
-- picks a tier and the price is computed from that tier's rate instead of the
-- flat price_per_sqm_cents.
--
-- Stored as jsonb on the product, mirroring the opening_types pattern:
--   [{ "key": "bas", "label": "Bas de gamme", "price_per_sqm_cents": 8000 }, ...]
--
-- Backward compatible: products with an empty quality_tiers array keep using
-- the flat price_per_sqm_cents, so nothing changes for existing rows.
--
-- The customer's chosen tier key is snapshotted on order_items / quotes.
-- ============================================================================

-- Per-product quality tiers + their €/m² rate.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS quality_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Chosen quality tier, snapshotted at purchase / quote-request time.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quality_tier text;
ALTER TABLE quotes      ADD COLUMN IF NOT EXISTS quality_tier text;
