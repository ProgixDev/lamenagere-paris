-- ============================================================================
-- Iteration 32: configurable area formula for per-m² products.
--
-- Per-m² products were always billed as largeur × hauteur, which only describes
-- a flat vertical surface (a glazed bay, a door). Two other shapes are sold the
-- same way but measured differently:
--   • carreaux / dalles      -> surface au sol: largeur × longueur
--   • cuisine en L, canapé   -> run développé:  (largeur + longueur) × hauteur
--   • cuisine en U, dressing -> run développé:  (gauche + fond + droite) × hauteur
--
-- products.area_formula picks one. It also decides which dimensions the app
-- asks the customer for, so the inputs and the price always agree.
-- 'width_height' is the default, so every existing product keeps the exact
-- price it had before this migration.
--
-- Bounds are deliberately NOT duplicated per dimension: every horizontal
-- dimension (largeur, longueur, gauche, fond, droite) is validated against
-- min_width/max_width, and the vertical one against min_height/max_height.
--
-- order_items gains one column per extra dimension so a line records exactly
-- what the customer entered. custom_width/custom_height keep their meaning.
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS area_formula text NOT NULL DEFAULT 'width_height'
  CHECK (area_formula IN ('width_height', 'width_length', 'l_shape', 'u_shape'));

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS custom_length numeric(8,2),
  ADD COLUMN IF NOT EXISTS custom_left   numeric(8,2),
  ADD COLUMN IF NOT EXISTS custom_back   numeric(8,2),
  ADD COLUMN IF NOT EXISTS custom_right  numeric(8,2);
