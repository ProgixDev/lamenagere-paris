-- ============================================================================
-- Iteration 6: push notifications + campaigns.
-- ============================================================================

CREATE TYPE device_platform AS ENUM ('ios', 'android');
CREATE TYPE push_provider   AS ENUM ('fcm', 'expo', 'apns');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sent', 'archived');

-- ── device tokens (push targets) ────────────────────────────────────────────
CREATE TABLE device_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform   device_platform NOT NULL,
  provider   push_provider NOT NULL,
  token      text NOT NULL UNIQUE,
  device_id  text,
  is_active  boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_device_tokens_profile ON device_tokens(profile_id);
CREATE INDEX idx_device_tokens_active ON device_tokens(is_active);

-- ── campaigns ───────────────────────────────────────────────────────────────
CREATE TABLE campaigns (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  title      text,
  body       text,
  audience   jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {accountType?, territory?}
  link       jsonb DEFAULT '{}'::jsonb,            -- {kind, ref}
  status     campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at    timestamptz,
  sent_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── campaign deliveries (per-recipient result) ──────────────────────────────
CREATE TABLE campaign_deliveries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  device_token_id uuid REFERENCES device_tokens(id) ON DELETE SET NULL,
  status      text NOT NULL,        -- 'sent' | 'error'
  error       text,
  sent_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_deliveries_campaign ON campaign_deliveries(campaign_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE device_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_tokens_owner_all ON device_tokens
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
-- campaigns / campaign_deliveries: admin only via service role (no anon policy).
