-- ============================================================================
-- Iteration 16: categories as configuration templates.
-- A category now carries an ordered list of "config blocks" (jsonb). Each block
-- is a reusable module the customer fills in on a product of that category:
-- measurements, shape (I/L/U), colors, accessories, door opening details, or
-- photo upload. Products inherit their category's blocks; per-product priced
-- option data (accessories/colors/opening details) is layered on the product.
-- Block shape (TypeScript: ConfigBlock):
--   { id, type, label, required?, multiple?, helpText?, planImage?,
--     fields?: [{key,label,unit?,min?,max?}],
--     options?: [{key,label,image?,hex?,surchargeCents?}],
--     items?: [{id,title,image?,priceCents?}] }
-- ============================================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS config_blocks jsonb NOT NULL DEFAULT '[]'::jsonb;
