import { isUuid } from './identifier.util';

/**
 * URL slugs for catalogue rows.
 *
 * ── Pourquoi le serveur normalise, et pas seulement le back-office ─────────
 * Le slug est l'URL publique d'une fiche (`/p/:slug`) et d'une rubrique
 * (`/:slug`). Le back-office laissait saisir n'importe quoi et le serveur
 * l'enregistrait tel quel : `VENDÔME`, `Porte SL200 ÉLÉGANCE`. Ces slugs-là
 * cassaient la fiche côté boutique (paramètre de route encodé deux fois → 404)
 * et donnaient des URL illisibles. Le serveur est le seul passage obligé de
 * toute écriture du catalogue : c'est donc ici que la règle tient.
 */

/** Lowercase ASCII, words joined by single dashes, no leading/trailing dash. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The first free slug derived from `base`: `base`, then `base-2`, `base-3`…
 *
 * `products.slug` and `categories.slug` are `UNIQUE`: saving a second
 * « HARMONIE » used to fail with a raw Postgres error in the back-office. A
 * suffix lets the save go through with a distinct URL instead.
 *
 * `reserved` are slugs that would be shadowed by a fixed route of the
 * storefront (a category called « Panier » would live at `/panier`). A slug
 * shaped like a UUID is avoided too: `/products/:id` would look it up by id.
 */
export function nextFreeSlug(
  base: string,
  taken: ReadonlySet<string>,
  reserved: ReadonlySet<string> = new Set(),
): string {
  const usable = (s: string) => !taken.has(s) && !reserved.has(s) && !isUuid(s);
  if (usable(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (usable(candidate)) return candidate;
  }
}
