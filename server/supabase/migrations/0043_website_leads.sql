-- ── Website leads (formulaire de contact public) ───────────────────────────
-- One row per submission from the landing site's /contact form, and later from
-- the /projet quiz, which hands off through `mailto:` today and loses every
-- visitor whose device has no mail client configured.
--
-- Anonymous by construction. There is no Supabase session on a landing page, so
-- unlike quotes (which hang off auth.users) this row is the *only* record that
-- the person ever existed. Nothing here is removed by a cascade, and nothing
-- here should ever gain a NOT NULL foreign key to a user.
--
-- `answers` is free-form jsonb, the same convention as website_briefs.answers
-- and order_items.configuration: reordering the quiz never needs a migration.
--
-- ── ip_hash, not ip_address ────────────────────────────────────────────────
-- An IP address is personal data under the GDPR, and the only thing this table
-- needs it for is a rate-limit window. sha256(ip || LEAD_IP_SALT) answers
-- "how many submissions from this connection in the last hour" and answers
-- nothing else — it cannot be reversed into an address, and rotating the salt
-- retires the whole history at once.
--
-- (website_briefs.ip_address stores the raw value. That predates this table and
-- should be revisited; it is also, today, storing the same useless constant for
-- every visitor — see the note on trustProxy in leads.controller.ts.)
--
-- Access is service-role only (RLS on, no policies), like website_briefs (0028),
-- promo_codes (0024) and invoices (0041). The public POST is guarded in the
-- service; reading is admin-only through the API. The API is the source of truth.

CREATE TABLE website_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  source        text NOT NULL DEFAULT 'site',    -- site|quiz|showroom
  name          text NOT NULL,
  email         text NOT NULL,
  phone         text,
  postal_code   text,                            -- drives "métropole ou outre-mer" at triage
  message       text NOT NULL,
  answers       jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent       boolean NOT NULL DEFAULT false,

  status        text NOT NULL DEFAULT 'nouveau', -- nouveau|contacte|qualifie|converti|spam|clos
  internal_note text,                            -- our own notes, never shown to the sender

  ip_hash       text,                            -- sha256(ip || LEAD_IP_SALT), see above
  user_agent    text,
  referer       text,                            -- triage only; never a gate, see the controller

  -- The notification is a convenience, the row is the record. When SMTP is
  -- unconfigured or the send fails, the request still succeeds and the reason
  -- lands here — the same shape as invoices.email_error (0041), so a lead that
  -- nobody was told about is visible in the admin list rather than silent.
  notified_at   timestamptz,
  notify_error  text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT website_leads_status_valid CHECK (
    status IN ('nouveau', 'contacte', 'qualifie', 'converti', 'spam', 'clos')
  ),
  CONSTRAINT website_leads_source_valid CHECK (
    source IN ('site', 'quiz', 'showroom')
  )
);

CREATE INDEX idx_website_leads_created ON website_leads(created_at DESC);
CREATE INDEX idx_website_leads_status ON website_leads(status);

-- The rate limit is a SQL count, not an in-memory counter: the API runs as a
-- serverless function and every instance has its own memory, so a Map-backed
-- limiter is not merely weakened, it is meaningless. Postgres is the only state
-- the instances share. This index is what makes the per-submission count cheap.
CREATE INDEX idx_website_leads_ip_window ON website_leads(ip_hash, created_at DESC);

-- Double-submit dedupe: same address, recently. The impatient double-click is
-- by far the most common source of duplicate leads.
CREATE INDEX idx_website_leads_email ON website_leads(lower(email), created_at DESC);

CREATE TRIGGER trg_website_leads_updated BEFORE UPDATE ON website_leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE website_leads ENABLE ROW LEVEL SECURITY;
