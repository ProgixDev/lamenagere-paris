-- ============================================================================
-- Iteration 3: catalog — categories, products, product_media, featured_products.
-- ============================================================================

CREATE TYPE product_type   AS ENUM ('standard', 'quote_only', 'configurable');
CREATE TYPE price_mode     AS ENUM ('fixed', 'calculated', 'quote');
CREATE TYPE product_status AS ENUM ('publie', 'brouillon', 'archive');
CREATE TYPE media_type     AS ENUM ('image', 'video');

-- ── categories ──────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  icon             text NOT NULL DEFAULT '',
  image_url        text,
  description      text,
  accent_color     text,
  parent_id        uuid REFERENCES categories(id) ON DELETE SET NULL,
  sort_order       int  NOT NULL DEFAULT 0,
  is_visible       boolean NOT NULL DEFAULT true,
  is_featured_home boolean NOT NULL DEFAULT false,
  b2b_only         boolean NOT NULL DEFAULT false,
  delivery_override text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_sort ON categories(sort_order);
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── products ────────────────────────────────────────────────────────────────
CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             text UNIQUE,
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  description     text NOT NULL DEFAULT '',
  short_description text,
  category_id     uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  product_type    product_type NOT NULL,
  price_mode      price_mode   NOT NULL,
  status          product_status NOT NULL DEFAULT 'brouillon',
  -- pricing (cents); coefficients are €/cm * 100
  base_price_cents    integer,
  purchase_cost_cents integer,
  width_coef_cents    integer,
  height_coef_cents   integer,
  -- dimensions
  dim_width numeric(8,2), dim_height numeric(8,2), dim_depth numeric(8,2),
  dim_unit text DEFAULT 'cm',
  ref_width numeric(8,2), ref_height numeric(8,2), ref_unit text DEFAULT 'cm',
  min_width numeric(8,2), min_height numeric(8,2),
  max_width numeric(8,2), max_height numeric(8,2),
  customizable boolean NOT NULL DEFAULT false,
  -- delivery
  delivery_metropole text NOT NULL DEFAULT '2-3 semaines',
  delivery_outremer  text NOT NULL DEFAULT '8-12 semaines',
  weight_kg numeric(8,2), volume_m3 numeric(8,3),
  free_shipping boolean NOT NULL DEFAULT false,
  -- inventory
  stock_qty int, low_stock_threshold int DEFAULT 3,
  -- seo / merchandising
  seo_title text, seo_description text,
  is_featured boolean NOT NULL DEFAULT false,
  popularity int NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- full-text search (French)
  search_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('french', coalesce(name,'') || ' ' || coalesce(description,''))
  ) STORED
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_popularity ON products(popularity DESC);
CREATE INDEX idx_products_search ON products USING gin(search_tsv);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── product_media ───────────────────────────────────────────────────────────
CREATE TABLE product_media (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type       media_type NOT NULL,
  url        text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_media_product ON product_media(product_id, sort_order);

-- ── featured_products (ordered home selection) ──────────────────────────────
CREATE TABLE featured_products (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  position   int NOT NULL DEFAULT 0
);
CREATE INDEX idx_featured_position ON featured_products(position);

-- ── RLS: public read of published/visible rows; writes via service role ──────
ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media  ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_public_read ON categories
  FOR SELECT USING (is_visible = true);
CREATE POLICY products_public_read ON products
  FOR SELECT USING (status = 'publie');
CREATE POLICY product_media_public_read ON product_media
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.status = 'publie')
  );
CREATE POLICY featured_public_read ON featured_products
  FOR SELECT USING (true);
