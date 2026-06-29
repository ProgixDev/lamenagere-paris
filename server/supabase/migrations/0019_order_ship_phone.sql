-- ============================================================================
-- Iteration 19: phone on the order's shipping snapshot.
-- Checkout now collects a single inline delivery form (incl. phone) instead of
-- a saved-address picker, so we snapshot the phone alongside the address.
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ship_phone text;
