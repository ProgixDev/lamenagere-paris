-- ============================================================================
-- Iteration 6: security hardening — addresses Supabase security advisors.
-- Reconstructed from the applied migration recorded in the database
-- (supabase_migrations.schema_migrations, version 20260603234857) so the repo
-- is a complete source of truth for a clean rebuild. All statements are
-- idempotent / safe to re-run.
-- ============================================================================

-- Address security advisors. NestJS uses the service-role key (bypasses RLS and
-- EXECUTE grants), so locking these down does not affect the backend.

-- 1. order_counters: enable RLS with no policies -> blocks anon/authenticated
--    entirely (service role still works). Fixes ERROR rls_disabled_in_public.
ALTER TABLE public.order_counters ENABLE ROW LEVEL SECURITY;

-- 2. Pin function search_path (fixes function_search_path_mutable WARN).
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.next_counter(text) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 3. These are trigger / internal functions — they must not be callable as
--    PostgREST RPCs by anon/authenticated. Revoking EXECUTE does not stop
--    triggers from firing (they run as the table owner).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.next_counter(text) FROM anon, authenticated, public;
