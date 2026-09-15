-- ═══════════════════════════════════════════════════════════════════════════
--  0048 — une recherche qui ne ment plus
--
--  Pourquoi
--  ────────
--  `search_tsv` (migration 0002) est un `to_tsvector('french', name ||
--  description)` nu. Sans désaccentuation, un client qui tape sans accent — ce
--  que fait tout le monde sur un clavier de téléphone — ne trouve rien.
--  Relevé sur la base de production le 14 septembre 2026 :
--
--    'baie vitrée'  ->  14 produits        'baie vitree'  ->  0
--    'cuisine'      ->  59 produits        'cuisne'       ->  0
--
--  Cette migration fait trois choses, toutes additives sauf la reconstruction
--  de `search_tsv`, qui est recalculée par PostgreSQL et n'appartient à
--  personne :
--
--    1. `f_unaccent()`, désaccentuation utilisable dans une colonne générée ;
--    2. `search_tsv` reconstruit, désaccentué et **pondéré** ;
--    3. `finish_keys`, les clés de finition en `text[]` indexable, plus
--       l'index trigramme qui servira au repli approximatif.
--
--  ── Le repli approximatif n'est PAS ici ────────────────────────────────────
--  L'index trigramme est posé, la fonction qui s'en sert ne l'est pas. Le seuil
--  `pg_trgm.word_similarity_threshold` doit être réglé sur des données réelles,
--  ce qui suppose l'extension installée — donc cette migration d'abord, la
--  fonction `produits_proches` ensuite, dans sa propre migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- Supabase héberge les extensions dans le schéma `extensions`, qui n'est pas
-- dans le `search_path` par défaut des rôles applicatifs. Tout ce qui suit les
-- appelle donc en les qualifiant.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ═══════════════════════════════════════════════════════════════════════════
--  1. La désaccentuation, en version immuable
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `unaccent(text)` — la forme à UN argument — est STABLE, pas IMMUTABLE, parce
-- qu'elle résout son dictionnaire à travers `search_path`. PostgreSQL la refuse
-- donc dans une colonne générée et dans une expression d'index.
--
-- ⚠️ Ne JAMAIS corriger ça par `ALTER FUNCTION extensions.unaccent(text)
-- IMMUTABLE`. C'est le remède qu'on trouve partout et il est faux :
--   · l'étiquette est perdue à chaque `ALTER EXTENSION unaccent UPDATE` ;
--   · la dépendance au `search_path` reste réelle, si bien qu'une restauration
--     exécutée avec un autre `search_path` calcule un tsvector DIFFÉRENT, sans
--     erreur, et l'index GIN se met à mentir sur le contenu de la table.
--
-- La forme à DEUX arguments avec un dictionnaire qualifié (`regdictionary`) n'a
-- aucune dépendance au `search_path` : elle est donc honnêtement immuable, et
-- une restauration `--schema-only` dans une base où `extensions` n'est pas dans
-- le chemin de recherche calcule exactement la même chose qu'ici.
--
-- Corollaire, et c'est une règle : ne jamais modifier `f_unaccent`. Si son
-- comportement doit changer, on ajoute une fonction et une migration — sinon
-- les tsvectors stockés et l'index divergent silencieusement.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

COMMENT ON FUNCTION public.f_unaccent(text) IS
  'unaccent(), en version immuable. Forme a deux arguments avec dictionnaire qualifie : aucune dependance au search_path, donc utilisable dans une colonne generee et dans un index. Ne jamais re-etiqueter extensions.unaccent(text) IMMUTABLE — voir migration 0048.';

-- ═══════════════════════════════════════════════════════════════════════════
--  2. `search_tsv`, désaccentué et pondéré
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Les poids ne servent à rien aujourd'hui — le tri par défaut reste la
-- popularité — et ils ne coûtent rien non plus. Ils sont la seule chose qui
-- rende un futur `sort=pertinence` possible : sans eux, `ts_rank` classe une
-- correspondance sur le nom en dessous d'un produit dont la description de
-- 3800 caractères répète le mot quatre fois.
--
--   A  nom                 ce que le client tape
--   B  sku, description courte
--   C  description         le bruit utile
--
-- ⚠️ `sku` est NULL sur 116 des 125 produits publiés et `short_description`
-- vide sur 121. Les indexer coûte presque rien, mais ne rapportera quelque
-- chose que le jour où le back-office les remplit. Ce n'est pas le gain de
-- cette migration ; le gain, c'est la désaccentuation.
--
-- Le DROP emporte `idx_products_search` avec la colonne. Le ADD réécrit la
-- table : 125 lignes, instantané. À six chiffres de produits il faudrait passer
-- par une colonne parallèle et un `ALTER TABLE ... RENAME`.
ALTER TABLE products DROP COLUMN search_tsv;

ALTER TABLE products
  ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (
       setweight(to_tsvector('french', public.f_unaccent(coalesce(name, ''))), 'A')
    || setweight(to_tsvector('french', public.f_unaccent(coalesce(sku, ''))), 'B')
    || setweight(to_tsvector('french', public.f_unaccent(coalesce(short_description, ''))), 'B')
    || setweight(to_tsvector('french', public.f_unaccent(coalesce(description, ''))), 'C')
  ) STORED;

COMMENT ON COLUMN products.search_tsv IS
  'Index plein texte francais, desaccentue et pondere (A nom, B sku + description courte, C description). Le terme cherche doit etre desaccentue AVANT la requete — voir common/search/terme.util.ts, qui doit rester le miroir exact de f_unaccent.';

CREATE INDEX idx_products_search ON products USING gin (search_tsv);

-- ═══════════════════════════════════════════════════════════════════════════
--  3. Les finitions, en colonne interrogeable
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── Pourquoi une colonne générée et pas `colors @> '[{"key":"noir"}]'` ──────
-- Le conteneur jsonb marche, et il est même indexable (`gin (colors
-- jsonb_path_ops)`). Il est écarté pour une raison qui n'a rien à voir avec
-- l'indexation : avec deux éléments, `@>` veut dire **ET**, alors que le client
-- qui coche « Noir » et « Blanc » attend **OU**. Exprimer le OU demande un
-- `or=(colors.cs.[{...}],colors.cs.[{...}])`, dont le parseur de PostgREST
-- coupe sur les virgules — et le JSON en est plein. C'est échappable et c'est
-- misérable. Avec un `text[]`, le OU est `.overlaps()` et le ET est
-- `.contains()`, tous deux servis par le même index GIN.
--
-- ── Pourquoi `products.colors` et pas `config_blocks` ──────────────────────
-- Les clés de couleur de `config_blocks` sont des identifiants de back-office
-- opaques (`opt_msm3vmwz4vk`, libellé « Marron » avec une espace finale), et
-- elles sont dupliquées d'un bloc à l'autre. Les exploiter supposerait de
-- slugifier des libellés sales : c'est un chantier de nettoyage de données, pas
-- un filtre. `products.colors[].key` est déjà propre et slugifié (`noir` 28,
-- `blanc` 23, `bleu` 11, `gris` 8 …) et couvre les 71 produits sur mesure,
-- c'est-à-dire toute la gamme fabriquée à la demande.
--
-- Mêmes gardes que `product_min_tier_cents` (migration 0045) et pour la même
-- raison : cette fonction est évaluée à chaque INSERT et UPDATE de `products`,
-- y compris depuis le back-office. Si elle lève, le gestionnaire ne peut plus
-- enregistrer sa fiche.
--   · `jsonb_typeof(...) = 'array'` — une valeur nulle ou un objet ne doit pas
--     faire échouer `jsonb_array_elements` ;
--   · le WHERE par élément — une entrée qui n'est pas un objet, ou dont la clé
--     est absente ou vide, est ignorée au lieu de faire échouer la ligne.
--
-- `lower(f_unaccent(...))` normalise à l'écriture, donc « Chêne », « chene » et
-- « CHÊNE » tombent sur la même clé et le côté TypeScript n'a qu'à appliquer la
-- même normalisation au filtre reçu.
CREATE OR REPLACE FUNCTION public.product_finish_keys(couleurs jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(array_agg(DISTINCT lower(public.f_unaccent(c->>'key'))), '{}')
  FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(couleurs) = 'array' THEN couleurs ELSE '[]'::jsonb END
       ) AS c
  WHERE jsonb_typeof(c) = 'object'
    AND nullif(trim(c->>'key'), '') IS NOT NULL;
$$;

COMMENT ON FUNCTION public.product_finish_keys(jsonb) IS
  'Cles de finition normalisees (minuscules, desaccentuees) d''un tableau products.colors. Immutable pour que finish_keys puisse en etre generee.';

ALTER TABLE products
  ADD COLUMN finish_keys text[]
  GENERATED ALWAYS AS (public.product_finish_keys(colors)) STORED;

COMMENT ON COLUMN products.finish_keys IS
  'products.colors[].key, normalisees, pour le filtre finition. OU = overlaps (ov), ET = contains (cs). Voir migration 0048.';

CREATE INDEX idx_products_finish_keys ON products USING gin (finish_keys);

-- ═══════════════════════════════════════════════════════════════════════════
--  4. L'index trigramme, pour le repli à venir
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Posé maintenant parce qu'il porte sur la même expression désaccentuée que le
-- reste, et qu'un index se crée une fois. Il ne sert à rien tant que
-- `produits_proches` n'existe pas ; il ne coûte que sa place.
--
-- ⚠️ L'opérateur du repli sera `word_similarity` (`<%`) et non `similarity`
-- (`%`) : les noms de produits font jusqu'à huit mots (« Série A970 – Baie
-- vitrée en aluminium à carreaux »), contre lesquels la similarité globale
-- d'une requête d'un seul mot ne franchit jamais le seuil. `gin_trgm_ops` sert
-- les deux.
CREATE INDEX idx_products_name_trgm
  ON products USING gin (public.f_unaccent(name) extensions.gin_trgm_ops);
