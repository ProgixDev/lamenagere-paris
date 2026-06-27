-- ============================================================================
-- Iteration 18: per-product configuration override.
-- A product normally inherits its category's config_blocks. When config_blocks
-- is set here (non-null), it fully overrides the category template for that
-- product — e.g. a specific kitchen offering different accessories/colors.
-- NULL means "inherit from the category" (the default).
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS config_blocks jsonb;
