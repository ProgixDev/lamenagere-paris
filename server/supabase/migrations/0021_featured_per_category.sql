-- ============================================================================
-- Iteration 21: per-category featured products ("Notre sélection" rail).
-- Generalizes featured_products into a curated-placement table:
--   category_id IS NULL  → the global home "Sélection" rail (unchanged behavior)
--   category_id = <cat>  → that category's curated rail, shown atop its screen
-- Position is scoped per rail (per category, or per the global rail).
-- ============================================================================

ALTER TABLE featured_products
  ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE CASCADE;

-- Replace the global UNIQUE(product_id) with scope-aware partial unique indexes
-- so a product can be both globally featured and featured within its category,
-- but never duplicated inside the same rail.
ALTER TABLE featured_products
  DROP CONSTRAINT IF EXISTS featured_products_product_id_key;

CREATE UNIQUE INDEX featured_products_global_uq
  ON featured_products (product_id) WHERE category_id IS NULL;
CREATE UNIQUE INDEX featured_products_category_uq
  ON featured_products (category_id, product_id) WHERE category_id IS NOT NULL;

CREATE INDEX idx_featured_category_position
  ON featured_products (category_id, position);
