-- ============================================================================
-- Iteration 10: profiles — collapse first_name/last_name into a single
-- full_name, and add an `onboarded` flag so OAuth sign-ups can be routed
-- through the interactive onboarding once (to capture name/account type/phone).
-- NOTE: `addresses` keeps its own first_name/last_name (shipping recipient).
-- ============================================================================

-- ── full_name ───────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN full_name text NOT NULL DEFAULT '';
UPDATE profiles
  SET full_name = btrim(concat_ws(' ', NULLIF(first_name, ''), NULLIF(last_name, '')));
ALTER TABLE profiles DROP COLUMN first_name;
ALTER TABLE profiles DROP COLUMN last_name;

-- ── onboarded flag ──────────────────────────────────────────────────────────
-- Existing users are considered onboarded; new rows default to false and are
-- flipped true once the client completes the onboarding flow (or at register).
ALTER TABLE profiles ADD COLUMN onboarded boolean NOT NULL DEFAULT false;
UPDATE profiles SET onboarded = true;

-- ── Recreate the auth trigger to populate full_name + onboarded ──────────────
-- For email/password sign-ups the NestJS layer sets these in user_metadata.
-- For Supabase-hosted Google OAuth, the provider supplies `full_name`/`name`
-- in raw_user_meta_data, which we capture here; `onboarded` stays false so the
-- mobile app collects account_type/phone before letting them in.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, account_type, company, siret, onboarded)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      ''
    ),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'account_type')::account_type, 'particulier'),
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'siret',
    COALESCE((NEW.raw_user_meta_data->>'onboarded')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
