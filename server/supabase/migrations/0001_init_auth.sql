-- ============================================================================
-- Iteration 1: platform foundations — enums, profiles, addresses, auth trigger,
-- order counters, shared helpers, RLS scaffold.
-- ============================================================================

-- ── Enums (iteration 1 subset) ──────────────────────────────────────────────
CREATE TYPE account_type  AS ENUM ('particulier', 'professionnel');
CREATE TYPE user_role     AS ENUM ('customer', 'admin', 'super_admin');
CREATE TYPE shipping_zone AS ENUM (
  'metropole', 'reunion', 'guadeloupe', 'martinique', 'guyane', 'mayotte'
);

-- ── Shared updated_at trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── profiles (1:1 with auth.users) ──────────────────────────────────────────
CREATE TABLE profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text NOT NULL,
  first_name        text NOT NULL DEFAULT '',
  last_name         text NOT NULL DEFAULT '',
  phone             text,
  account_type      account_type NOT NULL DEFAULT 'particulier',
  role              user_role    NOT NULL DEFAULT 'customer',
  company           text,
  siret             text,
  avatar_url        text,
  orders_count      int    NOT NULL DEFAULT 0,
  total_spent_cents bigint NOT NULL DEFAULT 0,
  last_activity_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_account_type ON profiles(account_type);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create a profile row whenever a Supabase auth user is created.
-- Pulls names/account_type from raw_user_meta_data when present (set at signup).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, phone, account_type, company, siret)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'account_type')::account_type, 'particulier'),
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'siret'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── addresses ───────────────────────────────────────────────────────────────
CREATE TABLE addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name  text NOT NULL,
  last_name   text NOT NULL,
  street      text NOT NULL,
  postal_code text NOT NULL,
  city        text NOT NULL,
  country     text NOT NULL DEFAULT 'France',
  territory   shipping_zone NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_addresses_profile ON addresses(profile_id);
CREATE UNIQUE INDEX uq_addr_default ON addresses(profile_id) WHERE is_default;

-- ── order/quote number counters (atomic per-year sequences) ─────────────────
CREATE TABLE order_counters (
  scope      text PRIMARY KEY,        -- e.g. 'order:2026', 'quote:2026'
  last_value int NOT NULL DEFAULT 0
);

-- Atomically increment and return the next value for a scope.
CREATE OR REPLACE FUNCTION next_counter(p_scope text)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v int;
BEGIN
  INSERT INTO order_counters(scope, last_value)
  VALUES (p_scope, 1)
  ON CONFLICT (scope)
  DO UPDATE SET last_value = order_counters.last_value + 1
  RETURNING last_value INTO v;
  RETURN v;
END;
$$;

-- ── RLS scaffold ────────────────────────────────────────────────────────────
-- NestJS uses the service-role key (bypasses RLS) and is the authorization
-- source of truth. Policies below are defense-in-depth for the anon/authed key.
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_self_select ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY addresses_owner_all ON addresses
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
