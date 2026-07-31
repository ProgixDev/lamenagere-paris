-- ============================================================================
-- Iteration 31: quantity cap for standard (fixed-price) products.
--
-- Standard products are sold by the unit: the app shows a − / + stepper next
-- to "Ajouter au panier" instead of the guided configuration flow. Two limits
-- bound that stepper, and the lower one wins:
--   • stock_qty          (0002_catalog.sql) — what's physically available
--   • max_per_order      — how many units a single order may take
--
-- NULL max_per_order = no per-order cap; the stepper is then bounded by stock
-- alone, or by the app's default ceiling when stock isn't tracked either.
-- ============================================================================

ALTER TABLE products
  ADD COLUMN max_per_order int
  CHECK (max_per_order IS NULL OR max_per_order > 0);
