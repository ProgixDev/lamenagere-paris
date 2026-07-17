-- ============================================================================
-- Iteration 27: product colours.
--
-- A product can offer several colour variants. Each colour carries a display
-- name, an optional hex swatch, and its own set of image URLs. When a customer
-- picks a colour on the product page, the gallery swaps to that colour's images.
--
-- Stored as a jsonb array on products (consistent with opening_types /
-- quality_tiers). Element shape:
--   { "key": "blanc", "name": "Blanc", "hex": "#ffffff",
--     "images": ["https://…/a.jpg", "https://…/b.jpg"] }
-- null / empty array = the product has no colour variants.
-- ============================================================================

ALTER TABLE products ADD COLUMN colors jsonb;
