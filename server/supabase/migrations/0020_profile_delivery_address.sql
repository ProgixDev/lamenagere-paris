-- ============================================================================
-- Iteration 20: remember the customer's delivery form.
-- The checkout collects the delivery address once; we store it on the profile
-- so it pre-fills next time. Shape: { firstName, lastName, street, postalCode,
-- city, phone }.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS delivery_address jsonb;
