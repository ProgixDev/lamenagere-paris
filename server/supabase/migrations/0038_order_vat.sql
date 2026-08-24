-- ── TVA on orders ───────────────────────────────────────────────────────────
-- Catalogue prices are HT. VAT is computed once at order creation from the
-- delivery postal code (20 % métropole, 0 % outre-mer — CGI art. 294) and
-- frozen here, so a reissued invoice always reproduces the amount charged even
-- if the rate later changes.
ALTER TABLE orders
  ADD COLUMN vat_rate_bp        integer NOT NULL DEFAULT 2000,
  ADD COLUMN vat_cents          integer NOT NULL DEFAULT 0,
  ADD COLUMN vat_exemption_note text;

COMMENT ON COLUMN orders.vat_rate_bp IS
  'VAT rate in basis points at the time of the order (2000 = 20 %).';
COMMENT ON COLUMN orders.vat_cents IS
  'VAT charged, in cents. total_cents is TTC and already includes it.';
COMMENT ON COLUMN orders.vat_exemption_note IS
  'Legal mention printed on the invoice when vat_rate_bp = 0.';

-- Backfill: orders placed before this migration were charged with no VAT line,
-- but the catalogue treated its prices as TTC at the time (see the pre-0038
-- comment on lib/constants.ts TVA_RATE). Recording the VAT implicitly contained
-- in those totals keeps total_cents untouched while making the historical
-- ledger declarable. Overseas orders were exempt then as now.
UPDATE orders
SET vat_rate_bp = 2000,
    vat_cents   = (total_cents - round(total_cents / 1.20))::integer
WHERE territory = 'metropole';

UPDATE orders
SET vat_rate_bp        = 0,
    vat_cents          = 0,
    vat_exemption_note = 'Exonération de TVA — art. 262-I et 294 du CGI (livraison hors du territoire de TVA métropolitain).'
WHERE territory <> 'metropole';
