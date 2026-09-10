-- ── Website consents (preuve du consentement cookies) ──────────────────────
-- One row per choice a visitor makes on the landing site's cookie banner:
-- accept all, refuse all, a custom selection, or a withdrawal. The CNIL asks
-- for proof that consent was collected and how; this table is that proof.
--
-- ── Append-only ─────────────────────────────────────────────────────────────
-- A change of mind is a new row (action = 'retirer' or 'personnaliser'), never
-- an update to the previous one: the history *is* the evidence. Hence no
-- updated_at and no trigger. The rows for one visitor share consent_id, a
-- random uuid minted by the browser and kept in the lmp_consentement cookie.
--
-- ── No personal data ────────────────────────────────────────────────────────
-- Nothing here names anyone. consent_id is random and means nothing outside
-- the visitor's own cookie; ip_hash is sha256(ip || LEAD_IP_SALT), exactly as
-- website_leads.ip_hash (0043) — same salt, same reasons: it answers "how many
-- receipts from this connection in the last hour" and nothing else. `page` is
-- the pathname only, never a query string.
--
-- ── Retention ───────────────────────────────────────────────────────────────
-- The consent itself is valid six months (see webapp lib/consentement.ts). The
-- receipt should outlive it by no more than 13 months. No purge job exists yet
-- — add a scheduled DELETE WHERE created_at < now() - interval '19 months' when
-- the table is old enough to need it.
--
-- Access is service-role only (RLS on, no policies), like website_leads (0043).
-- The public POST is guarded in the service; reading is admin-only by
-- consent_id, so a data-subject request can be answered.

CREATE TABLE website_consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  consent_id  uuid NOT NULL,                         -- minted by the browser, stored in its cookie
  version     text NOT NULL,                         -- policy VERSION the choice was made against
  action      text NOT NULL,                         -- accepter_tout|refuser_tout|personnaliser|retirer
  choices     jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {"mesure": bool, "marketing": bool}
  page        text,                                  -- pathname where the choice was made

  ip_hash     text,                                  -- sha256(ip || LEAD_IP_SALT), see above
  user_agent  text,

  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT website_consents_action_valid CHECK (
    action IN ('accepter_tout', 'refuser_tout', 'personnaliser', 'retirer')
  )
);

-- The admin lookup: every receipt for one visitor, newest first.
CREATE INDEX idx_website_consents_consent ON website_consents(consent_id, created_at DESC);

-- The rate limit, counted in Postgres for the reason given in 0043: the API
-- is serverless and Postgres is the only state its instances share.
CREATE INDEX idx_website_consents_ip_window ON website_consents(ip_hash, created_at DESC);

CREATE INDEX idx_website_consents_created ON website_consents(created_at DESC);

ALTER TABLE website_consents ENABLE ROW LEVEL SECURITY;
