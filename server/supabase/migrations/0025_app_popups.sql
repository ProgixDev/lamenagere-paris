-- ── App pop-ups ─────────────────────────────────────────────────────────────
-- Full-screen marketing images shown when the mobile app opens (announcements,
-- flyers, promotions). Each pop-up is a single image the user dismisses with an
-- X. A pop-up may optionally deep-link on tap to a product or a category
-- (link_kind = 'none' | 'product' | 'category'), mirroring carousel_slides.
-- Visibility is gated by is_active plus an optional [starts_at, ends_at] window;
-- ordering within a launch follows position (ascending). Access is service-role
-- only (RLS on, no policies): the API exposes active pop-ups on the public
-- storefront route and full CRUD on the admin routes.

CREATE TABLE app_popups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text,                              -- internal label / a11y text
  image_url        text NOT NULL,                     -- public storage URL
  image_path       text,                              -- storage path (for deletion)
  link_kind        text NOT NULL DEFAULT 'none',      -- none | category | product
  link_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  link_product_id  uuid REFERENCES products(id)   ON DELETE SET NULL,
  is_active        boolean NOT NULL DEFAULT true,
  position         integer NOT NULL DEFAULT 0,
  starts_at        timestamptz,                       -- NULL = no lower bound
  ends_at          timestamptz,                       -- NULL = no upper bound
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_popups_link_kind_valid CHECK (
    link_kind IN ('none', 'category', 'product')
  )
);
CREATE INDEX idx_app_popups_active ON app_popups(is_active);
CREATE TRIGGER trg_app_popups_updated BEFORE UPDATE ON app_popups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE app_popups ENABLE ROW LEVEL SECURITY;
