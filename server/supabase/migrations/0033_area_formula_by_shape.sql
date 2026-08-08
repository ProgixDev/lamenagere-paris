-- ============================================================================
-- Iteration 33: 'by_shape' joins the area formulas.
--
-- 0032 shipped four fixed formulas. A fitted kitchen doesn't fit any of them,
-- because its billable surface depends on a choice the *customer* makes: the
-- shape (I / L / U) decides how many wall runs are billed, and the runs are
-- measurements the customer already enters in the configuration blocks.
--
-- 'by_shape' reads both from those blocks instead of asking for dimensions a
-- second time:
--   surface = (somme des pans facturés) x hauteur
-- where a measurement field's `priceRole` marks it as height / run1 / run2 /
-- run3, and a shape option's `runs` says how many runs that shape bills.
--
-- Both tags live inside the existing config_blocks jsonb, so no new column.
-- ============================================================================

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_area_formula_check;

ALTER TABLE products
  ADD CONSTRAINT products_area_formula_check
  CHECK (area_formula IN (
    'width_height',
    'width_length',
    'l_shape',
    'u_shape',
    'by_shape'
  ));
