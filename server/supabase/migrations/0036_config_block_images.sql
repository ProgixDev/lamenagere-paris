-- ============================================================================
-- Iteration 36: media_usage() was blind to `planImage`.
--
-- 0035 scanned config blocks for the key `image`, which covers accessory and
-- option art. But ImagePick also writes `planImage` — the îlot photo and the
-- plan/schéma on measurement blocks — and that key was never checked.
--
-- Nothing sets planImage today, so nothing is broken yet. It becomes a hole the
-- moment someone uses it: media_usage() would report the image as unused and
-- the Gallery would happily offer to delete a plan that a live category still
-- renders.
--
-- Extracting the key list into one function so the next config-block image key
-- is a one-line change here rather than a silent gap in the delete guard.
-- ============================================================================

CREATE OR REPLACE FUNCTION config_block_images(blocks jsonb)
RETURNS SETOF text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v #>> '{}' FROM jsonb_path_query(blocks, 'strict $.**.image') v
  UNION
  SELECT v #>> '{}' FROM jsonb_path_query(blocks, 'strict $.**.planImage') v
$$;

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

  UNION ALL
  SELECT 'bloc de configuration', c.name::text
  FROM categories c
  WHERE jsonb_typeof(c.config_blocks) = 'array'
    AND EXISTS (
      SELECT 1 FROM config_block_images(c.config_blocks) u WHERE u = p_url
    )

  UNION ALL
  SELECT 'bloc de configuration', p.name::text
  FROM products p
  WHERE jsonb_typeof(p.config_blocks) = 'array'
    AND EXISTS (
      SELECT 1 FROM config_block_images(p.config_blocks) u WHERE u = p_url
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
REVOKE ALL ON FUNCTION config_block_images(jsonb) FROM anon, authenticated;
