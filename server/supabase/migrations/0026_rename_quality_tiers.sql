-- ============================================================================
-- Iteration 26: rename the default quality tiers.
--
-- The three seeded tiers were relabelled from "Bas / Milieu / Haute de gamme"
-- to "Économique / Intermédiaire / Premium". This rewrites the `label` field on
-- existing products' quality_tiers jsonb accordingly.
--
-- Only the labels change. The tier `key` (bas/milieu/haute) and its
-- price_per_sqm_cents are left untouched, so pricing and order_items /quotes
-- snapshots (which reference the key) stay valid.
--
-- Custom labels an admin typed by hand are left as-is: only elements whose
-- label matches one of the three old defaults are rewritten.
-- ============================================================================

UPDATE products p
SET quality_tiers = (
  SELECT jsonb_agg(
    CASE elem->>'label'
      WHEN 'Bas de gamme'    THEN jsonb_set(elem, '{label}', '"Économique"'::jsonb)
      WHEN 'Milieu de gamme' THEN jsonb_set(elem, '{label}', '"Intermédiaire"'::jsonb)
      WHEN 'Haute de gamme'  THEN jsonb_set(elem, '{label}', '"Premium"'::jsonb)
      ELSE elem
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(p.quality_tiers) WITH ORDINALITY AS t(elem, ord)
)
WHERE p.quality_tiers @> '[{"label": "Bas de gamme"}]'
   OR p.quality_tiers @> '[{"label": "Milieu de gamme"}]'
   OR p.quality_tiers @> '[{"label": "Haute de gamme"}]';
