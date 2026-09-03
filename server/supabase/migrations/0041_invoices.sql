-- ============================================================================
-- Post-payment invoice generation.
--
-- One row per order once its PDF facture has been generated (from
-- OrdersService.finalizeDraft(), the same place a draft becomes a real, paid
-- order — see order_drafts in 0040). invoice_number is its own gapless,
-- sequential series via next_counter('invoice:<year>'), distinct from
-- order_number: French law requires invoice numbers to be sequential on their
-- own series, not derived from something else.
--
-- Service-role only, same as stripe_webhook_events / order_drafts: nothing
-- here is read directly by a client yet (the PDF is emailed as an attachment,
-- not served from a public URL).
-- ============================================================================

CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number  text NOT NULL UNIQUE,
  pdf_path        text NOT NULL,
  emailed_at      timestamptz,
  email_error     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Private bucket: invoices carry customer PII (name, address) and financial
-- detail, and are only ever written/read by the server (service-role key
-- bypasses storage RLS) — never served as a public URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO UPDATE SET public = excluded.public;
