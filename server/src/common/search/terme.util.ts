/**
 * Le terme cherché, normalisé avant d'atteindre PostgreSQL.
 *
 * ── Pourquoi cette fonction doit exister ────────────────────────────────────
 * Depuis la migration 0048, `products.search_tsv` est construit sur
 * `f_unaccent(...)` : il ne contient plus que des lexèmes sans accent. Mais
 * PostgREST transmet le terme **tel quel** à `websearch_to_tsquery` — ni
 * `.textSearch()` de supabase-js ni PostgREST ne désaccentuent quoi que ce
 * soit. Sans ce passage, chercher « cuisinière » produirait la requête
 * `cuisinier` contre un index qui stocke `cuisiniere`, et ne rendrait rien :
 * exactement le bug que 0048 corrige, mais dans l'autre sens.
 *
 * Cette fonction est donc le **miroir TypeScript de `public.f_unaccent`**. Les
 * deux doivent rester d'accord ; le spec à côté est là pour le prouver à chaque
 * exécution des tests.
 *
 * ── Les ligatures, seul endroit où JS et `unaccent` divergent ───────────────
 * `normalize('NFD')` décompose les caractères accentués en lettre + diacritique
 * combinant, que la classe `\p{Diacritic}` supprime : `é → e`, `ç → c` (la
 * cédille est un diacritique combinant), `à → a`. Mais `œ`, `æ` et `ß` ne sont
 * pas des lettres accentuées, ce sont des lettres à part entière — NFD ne les
 * décompose pas, alors que le dictionnaire `unaccent` de PostgreSQL les
 * translittère. D'où le pré-passage : sans lui, « cœur » resterait « cœur » ici
 * et deviendrait « coeur » dans l'index.
 */

/** Ce que `unaccent` translittère et que `NFD` ne décompose pas. */
const LIGATURES: [RegExp, string][] = [
  [/œ/g, 'oe'],
  [/Œ/g, 'OE'],
  [/æ/g, 'ae'],
  [/Æ/g, 'AE'],
  [/ß/g, 'ss'],
  [/ø/g, 'o'],
  [/Ø/g, 'O'],
  [/đ/g, 'd'],
  [/Đ/g, 'D'],
  [/ł/g, 'l'],
  [/Ł/g, 'L'],
];

/**
 * Longueur maximale d'un terme accepté.
 *
 * Ce n'est pas une limite de confort : `websearch_to_tsquery` accepte des
 * requêtes arbitrairement longues, et une barre d'adresse en accepte des
 * milliers de caractères. Tronquer ici évite de faire porter à l'index un
 * travail que personne n'a demandé.
 */
const LONGUEUR_MAX = 120;

/**
 * Désaccentue, comprime les espaces, tronque. Ne fait rien d'autre — surtout
 * pas de mise en minuscules : `to_tsvector` s'en charge, et une recherche sur
 * une référence en capitales doit pouvoir rester lisible dans les journaux.
 */
export function normaliserTerme(brut: string): string {
  let terme = brut.normalize('NFC');
  for (const [motif, remplacement] of LIGATURES) {
    terme = terme.replace(motif, remplacement);
  }
  return terme
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LONGUEUR_MAX);
}

/**
 * La longueur minimale d'un terme qui vaut un aller-retour vers la base.
 *
 * Deux, et non un : contre un catalogue français de cent vingt-cinq produits,
 * un seul caractère rend presque tout après radicalisation, ce qui n'apprend
 * rien au client et coûte une requête à chaque frappe.
 */
export const LONGUEUR_MIN_SUGGESTION = 2;

/** Au-delà, ce n'est plus une frappe, c'est un collage. */
const MOTS_MAX = 8;

/**
 * Le terme, en `tsquery` **à préfixe** — celui qu'il faut pour la saisie en
 * cours.
 *
 * ── Pourquoi `websearch_to_tsquery` ne convient pas ici ─────────────────────
 * La recherche plein texte compare des **mots entiers radicalisés**. Elle est
 * parfaite quand le client a fini de taper et appuyé sur Entrée, et inutile
 * pendant qu'il tape : relevé sur la base de production,
 *
 *   websearch_to_tsquery('french', 'cuis')  ->  0 produit
 *   to_tsquery('french', 'cuis:*')          ->  59 produits
 *
 * Autrement dit, sans préfixe le panneau reste vide jusqu'à ce que le mot soit
 * complet — c'est-à-dire jusqu'au moment où il ne sert plus à rien. Seul le
 * dernier mot reçoit `:*` : les précédents, eux, sont finis.
 *
 * ── L'assainissement n'est pas facultatif ──────────────────────────────────
 * `to_tsquery` **analyse une syntaxe** (`&`, `|`, `!`, `<->`, parenthèses) et
 * lève sur une entrée mal formée — contrairement à `websearch_to_tsquery`, qui
 * pardonne tout. Un `(` tapé par le client ferait une 500. On ne garde donc que
 * lettres et chiffres, et les mots sont recomposés ici : aucun caractère de la
 * saisie n'atteint l'analyseur.
 *
 * Les mots vides français (« de », « la ») sont abandonnés par `to_tsquery`
 * sans faire échouer le reste — vérifié : `table & de:*` rend bien 5 produits.
 *
 * Rend `null` quand il ne reste rien d'interrogeable, auquel cas l'appelant ne
 * doit pas interroger la base du tout : une `tsquery` vide ne correspond à
 * aucune ligne, ce qui se lirait « aucun résultat » au lieu de « rien demandé ».
 */
export function tsqueryPrefixe(brut: string): string | null {
  const mots = normaliserTerme(brut)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, MOTS_MAX);

  if (mots.length === 0) return null;

  return mots
    .map((mot, i) => (i === mots.length - 1 ? `${mot}:*` : mot))
    .join(' & ');
}
