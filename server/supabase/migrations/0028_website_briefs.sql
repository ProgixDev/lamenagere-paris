-- ── Website briefs (questionnaire de cadrage) ───────────────────────────────
-- Backs the interactive scoping questionnaire we send to a prospect before
-- quoting a website project. One row per prospect; the page is opened with
-- ?slug=<slug>&t=<token> and autosaves as the prospect answers, so a brief that
-- is abandoned half-way is still fully readable on our side.
--
-- `answers` is a free-form jsonb map of question key -> value (string for a
-- single choice, string[] for a multi choice), mirroring the jsonb-as-answers
-- convention already used by order_items.configuration and products.config_blocks.
-- Keeping it schemaless means reordering or rewording the questionnaire never
-- requires a migration.
--
-- website_brief_events records every individual answer change so we can see the
-- order in which the prospect committed, and — more usefully — what they ticked
-- and then un-ticked before submitting.
--
-- Access is service-role only (RLS on, no policies), like app_popups (0025) and
-- promo_codes (0024). The public routes authenticate with the slug + token pair
-- and the owner routes with BRIEF_OWNER_KEY; the API is the source of truth.

CREATE TABLE website_briefs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL UNIQUE,          -- readable link segment, e.g. 'azzedine'
  token                 text NOT NULL UNIQUE,          -- edit secret carried in the URL (?t=)

  -- Who it is for. Pre-filled by us at creation, refined by the prospect on submit.
  client_name           text,
  client_email          text,
  client_phone          text,
  company               text,

  status                text NOT NULL DEFAULT 'draft', -- draft|submitted|reviewed|won|lost
  answers               jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_tier         text,                          -- essentiel|business|signature|custom
  estimated_total_cents integer,                       -- as displayed to the prospect
  progress_pct          integer NOT NULL DEFAULT 0,    -- 0..100, drives the progress bar

  -- Closing block, filled on the last step.
  domain_wish           text,
  timeline              text,
  budget_range          text,
  validated             boolean NOT NULL DEFAULT false,

  first_seen_at         timestamptz,                   -- first time the page was opened
  last_seen_at          timestamptz,                   -- last autosave (activity signal)
  submitted_at          timestamptz,
  user_agent            text,
  ip_address            text,

  internal_note         text,                          -- our own notes, never exposed to the prospect
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT website_briefs_status_valid CHECK (
    status IN ('draft', 'submitted', 'reviewed', 'won', 'lost')
  ),
  CONSTRAINT website_briefs_progress_range CHECK (
    progress_pct BETWEEN 0 AND 100
  )
);
CREATE INDEX idx_website_briefs_status ON website_briefs(status);
CREATE INDEX idx_website_briefs_last_seen ON website_briefs(last_seen_at DESC);
CREATE TRIGGER trg_website_briefs_updated BEFORE UPDATE ON website_briefs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE website_brief_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id     uuid NOT NULL REFERENCES website_briefs(id) ON DELETE CASCADE,
  kind         text NOT NULL,                          -- view|answer|tier|submit
  question_key text,                                   -- NULL for view/submit
  value        jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_brief_events_kind_valid CHECK (
    kind IN ('view', 'answer', 'tier', 'submit')
  )
);
CREATE INDEX idx_website_brief_events_brief
  ON website_brief_events(brief_id, occurred_at DESC);

ALTER TABLE website_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_brief_events ENABLE ROW LEVEL SECURITY;
