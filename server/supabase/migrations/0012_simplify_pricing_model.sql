-- ============================================================================
-- Iteration 12: simplify the product pricing model.
--
-- The catalog now offers customers only two pricing modes:
--   • fixed   — single price, direct purchase
--   • per_sqm — price per m², computed from customer-entered dimensions
--
-- This migrates existing rows off the retired modes:
--   • 'calculated' (coefficient-based) -> 'fixed' (keeps its base price; the
--     per-cm coefficients are simply no longer applied)
--   • 'quote' / product_type 'quote_only' -> made-to-measure 'per_sqm'
--
-- Quote-only products never carried a price, so they are converted to per_sqm
-- with default dimension bounds; any that still lack a €/m² rate are moved to
-- 'brouillon' (draft) so an admin must set the rate before they can sell again.
--
-- The 'quote' / 'quote_only' enum values are intentionally left in place
-- (Postgres can't easily drop enum values, and historical order_items / quotes
-- may still reference them) — they are simply no longer produced.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

BEGIN;

-- 1. Coefficient-based products become plain fixed-price products.
UPDATE products
SET price_mode        = 'fixed',
    product_type      = 'standard',
    customizable      = false,
    width_coef_cents  = NULL,
    height_coef_cents = NULL
WHERE price_mode = 'calculated';

-- 2. Quote-only products become made-to-measure, priced per m². Default the
--    dimension bounds where missing so the price can be clamped + computed.
UPDATE products
SET price_mode   = 'per_sqm',
    product_type = 'configurable',
    customizable = true,
    min_width    = COALESCE(min_width, 40),
    min_height   = COALESCE(min_height, 40),
    max_width    = COALESCE(max_width, 300),
    max_height   = COALESCE(max_height, 300)
WHERE price_mode = 'quote' OR product_type = 'quote_only';

-- 3. A per_sqm product with no rate can't be priced — unpublish it until an
--    admin sets price_per_sqm_cents from the product editor.
UPDATE products
SET status = 'brouillon'
WHERE price_mode = 'per_sqm'
  AND price_per_sqm_cents IS NULL
  AND status = 'publie';

COMMIT;
