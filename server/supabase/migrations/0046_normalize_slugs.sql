-- ═══════════════════════════════════════════════════════════════════════════
--  0046 — des slugs qui sont vraiment des slugs
--
--  Pourquoi
--  ────────
--  La colonne `slug` existe depuis `0002_catalog.sql` mais le back-office n'a
--  jamais slugifié : elle contient le **nom du produit recopié tel quel**.
--  Relevé le 11 septembre 2026, sur les 124 produits publiés :
--
--    slug non conforme (hors [a-z0-9-])   100
--    slug contenant une espace             89
--    slug contenant une majuscule         100
--
--  Exemples réels : « Série A970 – Baie vitrée en aluminium à carreaux »,
--  « CANAPÉ MONACO », « Carrelage en céramique effet marbre – Réf. NP7729A ».
--  Côté rubriques : « Portes intérieures » et « Volet store ».
--
--  Ce que ça cassait
--  ─────────────────
--  La boutique web adresse le catalogue par slug — c'est ce qui rend
--  `/boutique/p/...` lisible, partageable et indexable, et le référencement est
--  la raison d'être du site. Avec ces valeurs-là :
--
--   · l'URL devenait `/boutique/p/Cuisine%20NORA%20%E2%80%93%20L'%C3%A9l...`,
--     illisible et sans valeur pour le référencement ;
--   · le plan de site sortait un `<loc>` contenant une espace nue, ce qui le
--     rend invalide — et Search Console rejette un sitemap **en entier**, pas
--     ligne à ligne : une seule rubrique mal nommée faisait tomber
--     l'indexation de tout le catalogue ;
--   · les chemins contenant une espace ne se servaient tout simplement pas
--     (404), vérifié sur `/boutique/Volet%20store`.
--
--  Pourquoi c'est sûr maintenant
--  ─────────────────────────────
--  Rien ne dépend de ces valeurs : l'application mobile adresse tout par UUID
--  (son seul usage de `slug` est `canPlanIn3D`, qui cherche « cuisine » dans le
--  slug d'une rubrique — `cuisines` est déjà propre et ne bouge pas), le back
--  office adresse par UUID, et la boutique n'est pas encore en ligne. Aucune URL
--  publique ne pointe donc sur un ancien slug, et il n'y a pas de redirection à
--  écrire.
--
--  Simulé avant application : 129 slugs normalisés, **0 collision**, aucun vide,
--  3 dépassent 70 caractères et sont tronqués.
--
--  Une seule passe, et pourquoi elle suffit
--  ────────────────────────────────────────
--  `slug` est `NOT NULL UNIQUE`, et une contrainte d'unicité non différée est
--  vérifiée au fil des lignes mises à jour, pas en fin d'instruction. Renommer
--  en une passe peut donc échouer sur un doublon **transitoire** : le cas où le
--  nouveau slug d'une ligne est encore porté par une autre ligne pas encore
--  renommée.
--
--  Ce cas a été mesuré avant d'écrire cette migration, et il ne se produit pas :
--  aucun slug normalisé n'est égal au slug actuel d'une **autre** ligne (requête
--  de contrôle : 0). Une seule instruction est donc sûre, et elle évite de
--  dépendre d'une table temporaire — dont la durée de vie dépendrait de la façon
--  dont l'outil de migration enveloppe (ou non) le fichier dans une transaction.
--
--  Si un jour cette migration devait être rejouée sur des données où ce contrôle
--  ne rend plus 0, il faudrait repasser par un espace de noms temporaire.
-- ═══════════════════════════════════════════════════════════════════════════

-- La slugification, exposée comme fonction pour que le back-office puisse s'en
-- servir à l'écriture le jour où il voudra cesser de créer le problème.
--
-- `translate` fait une correspondance caractère à caractère : les deux chaînes
-- doivent avoir exactement la même longueur (56 ici). Tout ce qui n'est ni
-- lettre ASCII ni chiffre — tirets cadratins, apostrophes typographiques,
-- ponctuation, espaces — devient un tiret, puis les tirets consécutifs sont
-- réduits et ceux des extrémités retirés.
CREATE OR REPLACE FUNCTION slugifier(source text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(translate(
          coalesce(source, ''),
          'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñŒœÆæŸÿ',
          'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnOoAaYy')),
        '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'));
$$;

COMMENT ON FUNCTION slugifier(text) IS
  'Turns a label into a URL-safe slug: accents folded, lowercased, non-alphanumerics collapsed to single hyphens.';

-- ── produits ───────────────────────────────────────────────────────────────
WITH slugifie AS (
  SELECT id, slug AS ancien,
         -- Tronqué à 70 caractères : trois « slugs » font plusieurs centaines
         -- de caractères (ce sont des descriptions entières). On retaille le
         -- tiret que la troncature peut laisser en fin de chaîne.
         nullif(trim(both '-' from left(slugifier(slug), 70)), '') AS souhaite
  FROM products
),
-- Un slug vide n'arrive pas sur les données actuelles, mais un nom entièrement
-- composé de ponctuation le produirait. La colonne ne doit jamais devenir vide.
comble AS (
  SELECT id, ancien,
         coalesce(souhaite, 'produit-' || left(id::text, 8)) AS souhaite
  FROM slugifie
),
numerote AS (
  SELECT id, ancien, souhaite,
         row_number() OVER (PARTITION BY souhaite ORDER BY id) AS rang
  FROM comble
),
final AS (
  SELECT id, ancien,
         CASE WHEN rang = 1 THEN souhaite ELSE souhaite || '-' || rang END AS nouveau
  FROM numerote
)
UPDATE products p
SET slug = f.nouveau
FROM final f
WHERE p.id = f.id AND f.ancien IS DISTINCT FROM f.nouveau;

-- ── rubriques ──────────────────────────────────────────────────────────────
WITH slugifie AS (
  SELECT id, slug AS ancien,
         nullif(trim(both '-' from left(slugifier(slug), 70)), '') AS souhaite
  FROM categories
),
comble AS (
  SELECT id, ancien,
         coalesce(souhaite, 'rubrique-' || left(id::text, 8)) AS souhaite
  FROM slugifie
),
numerote AS (
  SELECT id, ancien, souhaite,
         row_number() OVER (PARTITION BY souhaite ORDER BY id) AS rang
  FROM comble
),
final AS (
  SELECT id, ancien,
         CASE WHEN rang = 1 THEN souhaite ELSE souhaite || '-' || rang END AS nouveau
  FROM numerote
)
UPDATE categories c
SET slug = f.nouveau
FROM final f
WHERE c.id = f.id AND f.ancien IS DISTINCT FROM f.nouveau;
