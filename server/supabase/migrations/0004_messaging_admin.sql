-- ============================================================================
-- Iteration 5: messaging, featured merchandising, settings, activity log.
-- ============================================================================

CREATE TYPE msg_sender    AS ENUM ('customer', 'admin');
CREATE TYPE pinned_kind   AS ENUM ('order', 'quote');
CREATE TYPE carousel_kind AS ENUM ('image', 'video');
CREATE TYPE carousel_link AS ENUM ('none', 'category', 'product');
CREATE TYPE activity_kind AS ENUM (
  'order', 'quote', 'message', 'product', 'customer', 'auth', 'campaign', 'system'
);

-- ── conversations / messages ────────────────────────────────────────────────
CREATE TABLE conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject       text NOT NULL,
  product_id    uuid REFERENCES products(id) ON DELETE SET NULL,
  vendor_name   text NOT NULL DEFAULT 'Service Client',
  vendor_avatar text,
  pinned_kind   pinned_kind,
  pinned_ref    text,
  pinned_label  text,
  last_message  text,
  last_message_at timestamptz,
  unread_customer int NOT NULL DEFAULT 0,
  unread_admin    int NOT NULL DEFAULT 0,
  is_b2b boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_profile ON conversations(profile_id);
CREATE INDEX idx_conversations_last ON conversations(last_message_at DESC);

CREATE TABLE messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender      msg_sender NOT NULL,
  sender_id   uuid REFERENCES profiles(id),
  content     text NOT NULL,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE message_attachments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  url        text NOT NULL,
  type       text NOT NULL DEFAULT 'image'
);

-- ── carousel slides / promo banners ─────────────────────────────────────────
CREATE TABLE carousel_slides (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind      carousel_kind NOT NULL DEFAULT 'image',
  title     text NOT NULL,
  subtitle  text,
  media_url text NOT NULL,
  link_kind carousel_link NOT NULL DEFAULT 'none',
  link_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  link_product_id  uuid REFERENCES products(id)   ON DELETE SET NULL,
  position  int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_carousel_position ON carousel_slides(position);

CREATE TABLE promo_banners (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge     text,
  title     text NOT NULL,
  subtitle  text,
  style     text,
  starts_at timestamptz,
  ends_at   timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  position  int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── settings (singleton) ────────────────────────────────────────────────────
CREATE TABLE settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name text, contact_email text, contact_phone text,
  warehouse_address text, siret text, tva_intracom text,
  tva_rate numeric(5,2) NOT NULL DEFAULT 20,
  free_shipping_threshold_cents integer DEFAULT 150000,
  auto_shipping_by_weight boolean NOT NULL DEFAULT true,
  maintenance_mode boolean NOT NULL DEFAULT false,
  deposit_enabled boolean DEFAULT true,
  deposit_threshold_cents integer DEFAULT 500000,
  admin_notif jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings (id, store_name, contact_email, tva_rate)
  VALUES (1, 'La Ménagère Paris', 'contact@lamenagereparis.fr', 20)
  ON CONFLICT (id) DO NOTHING;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── activity log (dashboard feed) ───────────────────────────────────────────
CREATE TABLE activity_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       activity_kind NOT NULL,
  actor_id   uuid REFERENCES profiles(id),
  entity_ref text,
  summary    text NOT NULL,
  meta       jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_slides     ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_banners       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log        ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_owner_read ON conversations
  FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY messages_owner_read ON messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.profile_id = auth.uid())
  );
CREATE POLICY carousel_public_read ON carousel_slides
  FOR SELECT USING (is_active = true);
CREATE POLICY banners_public_read ON promo_banners
  FOR SELECT USING (is_active = true);
CREATE POLICY settings_public_read ON settings
  FOR SELECT USING (true);
-- activity_log: admin only (service role); no anon policy.
