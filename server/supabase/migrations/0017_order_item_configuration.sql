-- ============================================================================
-- Iteration 17: per-line configuration snapshot on order items.
-- Stores what the customer chose for a configurable product (measurements,
-- shape, colors, accessories, opening details, location photos) as an
-- authoritative snapshot rebuilt server-side at checkout. Shape (TypeScript:
-- ItemConfiguration = ConfigSelectionEntry[]):
--   [{ blockId, type, label,
--      measurements?: [{key,label,value,unit?}],
--      shape?: {key,label},
--      colors?: [{key,label,surchargeCents?}],
--      accessories?: [{id,title,priceCents?}],
--      opening?: {key,label,surchargeCents?},
--      photos?: [{url,type}] }]
-- ============================================================================

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS configuration jsonb NOT NULL DEFAULT '[]'::jsonb;
