-- ============================================================================
-- Iteration 11: parametric (per-m²) pricing + opening-type selection for
-- made-to-measure products (doors / windows / bay windows).
--
-- - New price mode 'per_sqm': unit price = area(m²) × price_per_sqm, with the
--   width/height clamped to the existing min/max columns.
-- - Per-product list of allowed opening types, each with an optional surcharge,
--   stored as jsonb: [{ "type": "coulissante", "surcharge_cents": 15000 }, ...].
-- - The customer's chosen opening type is snapshotted on order_items / quotes.
-- ============================================================================

-- New enum value. (Not used elsewhere in this migration, so adding it here is
-- safe even when migrations run inside a transaction.)
ALTER TYPE price_mode ADD VALUE IF NOT EXISTS 'per_sqm';

-- Per-m² rate, in cents per square metre (e.g. 10000 = 100 €/m²).
ALTER TABLE products ADD COLUMN price_per_sqm_cents integer;

-- Allowed opening types for this product + their per-type surcharge.
ALTER TABLE products
  ADD COLUMN opening_types jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Chosen opening type, snapshotted at purchase / quote-request time.
ALTER TABLE order_items ADD COLUMN opening_type text;
ALTER TABLE quotes      ADD COLUMN opening_type text;
