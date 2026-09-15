import {
  CATALOG_SORTS,
  type CatalogFilters,
  type CatalogSort,
} from './products.service';
import type { ProductType } from './catalog.serializer';

/**
 * The product types a client may ask for.
 *
 * `quote_only` is deliberately absent. It is still a valid enum value in the
 * database, but migration 0012 moved every row off it and states that none will
 * be produced again — it matches zero published products. Accepting it here
 * would make `?type=quote_only` return an empty catalogue, which reads as
 * "nothing in stock" rather than "that filter is meaningless".
 */
const TYPES_ACCEPTES: ProductType[] = ['standard', 'configurable'];

/**
 * A repeatable query parameter, in either of the two shapes it arrives in.
 *
 * A native `<form method="get">` with checkboxes serialises as
 * `?cat=cuisines&cat=portes` — the storefront works without JavaScript, so that
 * form is not hypothetical. The JS island and this repo's own convention
 * (`/products/by-ids?ids=a,b,c`) use commas. Both must be understood, because
 * the same URL has to survive being produced by either one.
 */
export function parseListe(value?: string | string[]): string[] {
  const brut = Array.isArray(value) ? value : value == null ? [] : [value];
  return [
    ...new Set(
      brut
        .flatMap((s) => s.split(','))
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Reads the catalogue narrowing out of the query string.
 *
 * ── Tout est optionnel, et une valeur illisible est ignoree ────────────────
 * Ces parametres arrivent d'une barre d'adresse : ils sont edites a la main,
 * tronques par un partage, gardes en favori apres un changement de version.
 * Un `?sort=prix-croissant` herite d'une ancienne version doit rendre le
 * catalogue trie par defaut, pas une erreur 400 sur une page indexee par
 * Google. Aucun de ces champs ne touche a l'argent — le prix est refait au
 * paiement — donc le pardon ne coute rien ici.
 *
 * Les prix arrivent en euros, parce que c'est ce que le client affiche, et
 * repartent en centimes, parce que c'est la seule unite que ce serveur
 * manipule.
 */
export function parseFilters(q: {
  sort?: string;
  priceMin?: string;
  priceMax?: string;
  minRating?: string;
  type?: string | string[];
  /** Cotes visees, en centimetres. */
  w?: string;
  h?: string;
}): CatalogFilters {
  const filters: CatalogFilters = {};

  if (q.sort && (CATALOG_SORTS as string[]).includes(q.sort)) {
    filters.sort = q.sort as CatalogSort;
  }

  const min = euroQueryToCents(q.priceMin);
  const max = euroQueryToCents(q.priceMax);
  // Bornes inversees : on les remet dans l'ordre plutot que de rendre une
  // liste vide, qui se lirait comme « aucun produit » et non comme « filtre
  // incoherent ».
  if (min != null && max != null && min > max) {
    filters.priceMinCents = max;
    filters.priceMaxCents = min;
  } else {
    if (min != null) filters.priceMinCents = min;
    if (max != null) filters.priceMaxCents = max;
  }

  const rating = Number(q.minRating);
  if (Number.isFinite(rating) && rating > 0) {
    filters.minRating = Math.min(5, rating);
  }

  // Une valeur inconnue est jetee, pas refusee : `?type=sur-mesure` (le libelle
  // francais, qu'un client pourrait ecrire a la main) rend le catalogue entier
  // plutot qu'une erreur. Si plus rien ne reste, le champ est omis — un
  // tableau vide serait un `.in('product_type', [])`, qui ne rend rien.
  const types = parseListe(q.type).filter((t): t is ProductType =>
    (TYPES_ACCEPTES as string[]).includes(t),
  );
  if (types.length) filters.productTypes = types;

  const largeur = coteQueryToCm(q.w);
  const hauteur = coteQueryToCm(q.h);
  if (largeur != null) filters.widthCm = largeur;
  if (hauteur != null) filters.heightCm = hauteur;

  return filters;
}

/**
 * A dimension from the query string, in whole centimetres.
 *
 * Bounded at both ends, and that matters twice over. `applyCotes` interpolates
 * this number straight into a PostgREST `or=` string — it is the only value in
 * the filter set that ends up inside a filter expression rather than as a bound
 * parameter — so it must be provably a plain integer. And a cote outside
 * [1, 2000] cm is not a request the workshop can answer — twenty metres is not
 * a kitchen — so the ceiling costs nothing and the floor rules out the zero and
 * the negative that a hand-edited URL produces.
 *
 * Rounded rather than refused: a client typing 240.5 has measured carefully,
 * and telling them their measurement is invalid would be absurd when the
 * workshop verifies every cote by telephone anyway.
 */
export function coteQueryToCm(value?: string): number | undefined {
  if (value == null || value === '') return undefined;
  const cm = Number(value);
  if (!Number.isFinite(cm)) return undefined;
  const arrondi = Math.round(cm);
  if (arrondi < 1 || arrondi > 2000) return undefined;
  return arrondi;
}

/** A euro amount from the query string, as cents. Negatives clamp to zero. */
export function euroQueryToCents(value?: string): number | undefined {
  if (value == null || value === '') return undefined;
  const euros = Number(value);
  if (!Number.isFinite(euros)) return undefined;
  return Math.max(0, Math.round(euros * 100));
}
