-- ============================================================================
-- Iteration 35: folders the manager can create, and a straight answer to
-- "is this image still in use?".
--
-- 0034 gave every stored file a row and a folder name. Two pieces are missing
-- before the Gallery can exist:
--
--   1. A folder has to be able to be EMPTY. `media_assets.folder` only records
--      folders that already hold something, so "Nouveau dossier" would vanish
--      the moment the page reloaded. media_folders is the list itself.
--
--   2. Deleting has to be safe. Today DELETE /admin/media removes the object
--      from storage with no check at all, so deleting an image a product still
--      shows silently breaks the storefront — the URL is stored verbatim in
--      product_media, config blocks, carousel slides and pop-ups, and nothing
--      notices until a customer sees a blank tile. media_usage() is the lookup
--      the delete endpoint refuses on, and what the UI shows instead.
--
-- media_usage() deliberately covers config_blocks too. That's where accessory
-- art is referenced, it's the media most likely to be shared across products,
-- and it's exactly the case a naive "is it in product_media?" check would miss.
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE media_folders ENABLE ROW LEVEL SECURITY;

-- Seed from whatever the backfill already produced, so the Gallery opens on the
-- folders that exist rather than on an empty list.
INSERT INTO media_folders (name)
SELECT DISTINCT folder FROM media_assets WHERE folder IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Everything that references a given public URL.
--
-- STABLE, not IMMUTABLE: it reads tables. Returns zero rows when the asset is
-- unused, which is the caller's signal that deleting it is safe.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION media_usage(p_url text)
RETURNS TABLE (source text, label text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 'produit'::text, p.name::text
  FROM product_media pm
  JOIN products p ON p.id = pm.product_id
  WHERE pm.url = p_url

  UNION ALL
  SELECT 'catégorie', c.name::text
  FROM categories c WHERE c.image_url = p_url

  -- Accessory / option art lives nested inside the config blocks.
  UNION ALL
  SELECT 'bloc de configuration', c.name::text
  FROM categories c
  WHERE jsonb_typeof(c.config_blocks) = 'array'
    AND EXISTS (
      SELECT 1 FROM jsonb_path_query(c.config_blocks, 'strict $.**.image') v
      WHERE v #>> '{}' = p_url
    )

  UNION ALL
  SELECT 'bloc de configuration', p.name::text
  FROM products p
  WHERE jsonb_typeof(p.config_blocks) = 'array'
    AND EXISTS (
      SELECT 1 FROM jsonb_path_query(p.config_blocks, 'strict $.**.image') v
      WHERE v #>> '{}' = p_url
    )

  UNION ALL
  SELECT 'carrousel', coalesce(s.title, 'Diapositive')::text
  FROM carousel_slides s WHERE s.media_url = p_url

  UNION ALL
  SELECT 'pop-up', coalesce(a.title, 'Pop-up')::text
  FROM app_popups a WHERE a.image_url = p_url

  UNION ALL
  SELECT 'message', 'Pièce jointe'::text
  FROM message_attachments m WHERE m.url = p_url

  UNION ALL
  SELECT 'devis', 'Pièce jointe'::text
  FROM quote_attachments q WHERE q.url = p_url

  UNION ALL
  SELECT 'commande', o.order_number::text
  FROM orders o
  WHERE jsonb_typeof(o.customer_attachments) = 'array'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(o.customer_attachments) e
      WHERE e->>'url' = p_url
    )

  UNION ALL
  SELECT 'article commandé', oi.product_name::text
  FROM order_items oi WHERE oi.product_image = p_url
$$;

REVOKE ALL ON FUNCTION media_usage(text) FROM anon, authenticated;
