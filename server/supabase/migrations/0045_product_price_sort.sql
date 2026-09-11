-- ═══════════════════════════════════════════════════════════════════════════
--  0045 — un prix triable par produit
--
--  Pourquoi
--  ────────
--  La boutique web doit offrir « trier par prix » et « filtrer par prix » sur
--  une grille paginée. Le tri doit donc se faire dans SQL : trier une page de
--  vingt produits côté client réordonne vingt lignes sur cent vingt-quatre et
--  ment au client sur toutes les autres.
--
--  Or aucune colonne existante ne porte le prix affiché. Le catalogue mélange
--  trois formes de prix, et la carte produit affiche (`priceTagLabel` côté app,
--  `libellePrix` côté web) :
--
--    · prix fixe          -> base_price_cents
--    · au m² sans gamme   -> price_per_sqm_cents
--    · au m² avec gammes  -> « dès » + la gamme la MOINS chère
--
--  Le dernier cas est le cas majoritaire — 67 des 72 produits au m² — et c'est
--  celui qu'aucune colonne ne couvre. Relevé sur la base le 11 septembre 2026 :
--
--    price_per_sqm_cents = la gamme la moins chère   45 produits
--    price_per_sqm_cents diverge de la gamme mini    18 produits
--    price_per_sqm_cents absent alors qu'il y a des gammes   4 produits
--
--  Autrement dit, trier sur `price_per_sqm_cents` classerait 22 produits sur 67
--  d'après un nombre que le client ne voit nulle part. D'où cette colonne, qui
--  reprend exactement la règle d'affichage.
--
--  ⚠️ Unités mélangées, en connaissance de cause. Un produit à 490 € et un
--  produit à 490 €/m² tombent au même rang. C'est inhérent à un catalogue qui
--  vend des deux façons, et c'est le comportement le moins surprenant : le tri
--  suit l'ordre des nombres que le client lit sur les cartes. Ne pas s'en servir
--  pour autre chose qu'un tri ou un filtre d'affichage — ce n'est pas un prix,
--  c'est une clé de tri.
--
--  Additif et réversible : aucune colonne existante n'est touchée, la valeur est
--  calculée par PostgreSQL, et personne n'écrit dedans.
-- ═══════════════════════════════════════════════════════════════════════════

-- La gamme la moins chère d'un tableau `quality_tiers`, en centimes.
--
-- IMMUTABLE et PARALLEL SAFE : exigé pour qu'une colonne générée puisse
-- l'appeler. La fonction ne lit que son argument, donc les deux sont vrais.
--
-- Les deux gardes ne sont pas de la prudence décorative : cette fonction est
-- évaluée à chaque INSERT et UPDATE de `products`, y compris depuis le back
-- office. Si elle lève, l'admin ne peut plus enregistrer sa fiche produit.
--   · `jsonb_typeof(...) = 'array'` — une valeur nulle ou un objet ne doit pas
--     faire échouer `jsonb_array_elements`.
--   · le WHERE sur `jsonb_typeof(...) = 'number'` — une gamme sans prix, ou
--     avec un prix écrit en texte, est ignorée au lieu de faire échouer le cast.
CREATE OR REPLACE FUNCTION product_min_tier_cents(tiers jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT min((t->>'price_per_sqm_cents')::int)
  FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(tiers) = 'array' THEN tiers ELSE '[]'::jsonb END
       ) AS t
  WHERE jsonb_typeof(t->'price_per_sqm_cents') = 'number';
$$;

COMMENT ON FUNCTION product_min_tier_cents(jsonb) IS
  'Cheapest quality tier rate (cents/m²) in a products.quality_tiers array, or NULL. Immutable so price_sort_cents can be generated from it.';

ALTER TABLE products
  ADD COLUMN price_sort_cents integer
  GENERATED ALWAYS AS (
    CASE
      WHEN price_mode = 'per_sqm'
        THEN COALESCE(product_min_tier_cents(quality_tiers), price_per_sqm_cents)
      ELSE COALESCE(base_price_cents, price_per_sqm_cents)
    END
  ) STORED;

COMMENT ON COLUMN products.price_sort_cents IS
  'Display price used for sorting/filtering only: base price, or the cheapest quality tier for per-m² products. Mixes € and €/m² by design — see migration 0045.';

-- Le catalogue filtre toujours sur `status`, donc l'index porte les deux
-- colonnes : un index sur le seul prix serait ignoré au profit d'un parcours
-- séquentiel dès que le filtre de statut est sélectif.
CREATE INDEX idx_products_status_price_sort
  ON products (status, price_sort_cents);
