-- ============================================================================
-- Iteration 22: product reviews — post-purchase star ratings.
-- A customer can rate (1–5 stars + optional comment) a product they bought,
-- once the order containing that line reached the 'livree' (delivered) status.
-- One review per purchased line (order_item). Aggregates are denormalized onto
-- products(rating_avg, rating_count) so the catalog can sort/filter/display
-- without a join. Reviews are public-read (shown on the product page); writes
-- go through the NestJS service (service role), matching the repo convention.
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  rating        int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_profile ON product_reviews(profile_id);

CREATE TRIGGER trg_product_reviews_updated
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Denormalized rating aggregates on products (kept in sync by ReviewsService).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rating_avg numeric(2,1) NOT NULL DEFAULT 0;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rating_count int NOT NULL DEFAULT 0;

-- RLS: public read (reviews appear on the product page); writes via service role.
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_reviews_public_read ON product_reviews
  FOR SELECT USING (true);
