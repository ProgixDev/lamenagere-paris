-- ============================================================================
-- Iteration 14: customer note + attachments on orders.
-- Lets the buyer describe their order in depth and attach photos/videos before
-- paying. Attachments are stored as a JSON array of { url, type } (same shape
-- as message attachments — files are uploaded to the shared uploads bucket).
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_note text;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
