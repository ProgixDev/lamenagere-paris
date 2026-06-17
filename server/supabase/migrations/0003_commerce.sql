-- ============================================================================
-- Iteration 4: commerce — orders, quotes, shipping fees.
-- ============================================================================

CREATE TYPE order_status AS ENUM (
  'commande_confirmee', 'en_preparation', 'en_attente_expedition',
  'expediee', 'livree'
);
CREATE TYPE quote_status AS ENUM (
  'en_attente_devis', 'devis_envoye', 'devis_accepte', 'devis_rejete'
);

-- ── per-zone shipping fees / delays ─────────────────────────────────────────
CREATE TABLE shipping_zone_fees (
  zone      shipping_zone PRIMARY KEY,
  delay     text NOT NULL,
  fee_cents integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
INSERT INTO shipping_zone_fees (zone, delay, fee_cents) VALUES
  ('metropole',  '2-3 semaines',  0),
  ('reunion',    '8-12 semaines', 25000),
  ('guadeloupe', '8-12 semaines', 25000),
  ('martinique', '8-12 semaines', 25000),
  ('guyane',     '8-12 semaines', 30000),
  ('mayotte',    '8-12 semaines', 35000);

-- ── orders ──────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number  text NOT NULL UNIQUE,
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status        order_status NOT NULL DEFAULT 'commande_confirmee',
  subtotal_cents      integer NOT NULL,
  shipping_cost_cents integer NOT NULL DEFAULT 0,
  total_cents         integer NOT NULL,
  territory      shipping_zone NOT NULL,
  shipping_method text NOT NULL,
  estimated_delivery text NOT NULL,
  -- snapshot of the shipping address
  ship_first_name text, ship_last_name text, ship_street text,
  ship_postal_code text, ship_city text, ship_country text,
  ship_territory shipping_zone,
  -- tracking
  carrier text, tracking_number text, tracking_url text,
  is_b2b boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_profile ON orders(profile_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_image text,
  quantity     int NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL,
  custom_width  numeric(8,2), custom_height numeric(8,2),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE order_timeline (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id  uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status    order_status NOT NULL,
  label     text NOT NULL,
  note      text,
  completed boolean NOT NULL DEFAULT true,
  occurred_at timestamptz
);
CREATE INDEX idx_order_timeline_order ON order_timeline(order_id);

CREATE TABLE order_notes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id  uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id),
  body      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── quotes ──────────────────────────────────────────────────────────────────
CREATE TABLE quotes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE,
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  product_id   uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text,
  product_image text,
  req_width  numeric(8,2), req_height numeric(8,2), req_depth numeric(8,2),
  notes        text,
  status       quote_status NOT NULL DEFAULT 'en_attente_devis',
  quoted_price_cents integer,
  shipping_cents integer, fabrication_delay text, validity_days int DEFAULT 60,
  admin_message text, tva_rate numeric(5,2) DEFAULT 20, pdf_url text,
  sent_at timestamptz, decided_at timestamptz,
  is_b2b boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quotes_profile ON quotes(profile_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE quote_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    int NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL,
  sort_order  int NOT NULL DEFAULT 0
);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);

CREATE TABLE quote_attachments (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  url      text NOT NULL,
  type     text NOT NULL DEFAULT 'image',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── RLS: owner-scoped reads; writes via service role ────────────────────────
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_timeline    ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zone_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_owner_read ON orders
  FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY order_items_owner_read ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.profile_id = auth.uid())
  );
CREATE POLICY order_timeline_owner_read ON order_timeline
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.profile_id = auth.uid())
  );
CREATE POLICY quotes_owner_read ON quotes
  FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY quote_items_owner_read ON quote_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.profile_id = auth.uid())
  );
CREATE POLICY quote_attachments_owner_read ON quote_attachments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.profile_id = auth.uid())
  );
CREATE POLICY shipping_fees_public_read ON shipping_zone_fees
  FOR SELECT USING (true);
-- order_notes: no anon policy (admin-only via service role).
