import {
  CATALOG_SORTS,
  type CatalogFilters,
  type CatalogSort,
} from './products.service';

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

  return filters;
}

/** A euro amount from the query string, as cents. Negatives clamp to zero. */
export function euroQueryToCents(value?: string): number | undefined {
  if (value == null || value === '') return undefined;
  const euros = Number(value);
  if (!Number.isFinite(euros)) return undefined;
  return Math.max(0, Math.round(euros * 100));
}
