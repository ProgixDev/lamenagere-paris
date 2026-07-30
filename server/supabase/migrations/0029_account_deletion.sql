-- ============================================================================
-- Iteration 29: make in-app account deletion actually possible.
--
-- orders.profile_id and quotes.profile_id were ON DELETE RESTRICT, so
-- auth.admin.deleteUser() failed for every customer who had ever placed an
-- order or asked for a quote — they were told to "contact support" instead.
-- App Store guideline 5.1.1(v) and GDPR art. 17 both require the user to be
-- able to complete deletion themselves, in the app.
--
-- We cannot simply cascade: invoicing records must be kept (French commercial
-- law retains accounting documents for 10 years). So we detach instead.
-- The order/quote row survives with profile_id NULL for the books, and the API
-- scrubs its personal fields (name, address, phone, free-text notes) before
-- deleting the account — see AuthService.deleteAccount. Both tables' RLS read
-- policies are `auth.uid() = profile_id`, which NULL never satisfies, so
-- detached rows stop being reachable by any end user.
-- ============================================================================

-- 1. Allow the column to be emptied.
ALTER TABLE orders ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE quotes ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Drop whichever FK currently guards the column. Looked up from the catalog
--    rather than by guessed name: a hardcoded `DROP CONSTRAINT IF EXISTS
--    <guess>` would silently no-op on a name mismatch and leave RESTRICT in
--    place — the exact bug this migration exists to fix.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.relname AS tbl, c.conname AS con
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND t.relnamespace = 'public'::regnamespace
      AND t.relname IN ('orders', 'quotes')
      AND a.attname = 'profile_id'
      AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.con);
  END LOOP;
END $$;

-- 3. Re-add as SET NULL.
ALTER TABLE orders
  ADD CONSTRAINT orders_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 4. Fail loudly if anything still blocks deletion, so a silent partial apply
--    can never look like success. confdeltype: 'n' = SET NULL, 'r' = RESTRICT,
--    'a' = NO ACTION (also blocks).
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(format('%s.%s (%s)', t.relname, a.attname, c.confdeltype), ', ')
    INTO bad
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
  WHERE c.contype = 'f'
    AND t.relnamespace = 'public'::regnamespace
    AND t.relname IN ('orders', 'quotes')
    AND a.attname = 'profile_id'
    AND c.confdeltype <> 'n';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'account deletion still blocked by FK(s): %', bad;
  END IF;
END $$;
