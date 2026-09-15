import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  buildPaginated,
  PaginatedResponse,
  pageRange,
} from '../../common/serialization/pagination';
import { identifierColumn } from '../../common/serialization/identifier.util';
import {
  LONGUEUR_MIN_SUGGESTION,
  normaliserTerme,
  tsqueryPrefixe,
} from '../../common/search/terme.util';
import {
  PRODUCT_SELECT,
  ProductDto,
  ProductRow,
  ProductType,
  SUGGEST_SELECT,
  SuggestDto,
  SuggestRow,
  toProductDto,
  toSuggestDto,
} from './catalog.serializer';

/** Published prices, bucketed on a log scale. Empty `buckets` = no priced product. */
export interface PriceHistogramDto {
  minCents: number;
  maxCents: number;
  avgCents: number;
  buckets: number[];
}

/** How a catalogue listing may be ordered. */
export type CatalogSort = 'popular' | 'recent' | 'price_asc' | 'price_desc';

export const CATALOG_SORTS: CatalogSort[] = [
  'popular',
  'recent',
  'price_asc',
  'price_desc',
];

/**
 * The optional narrowing a catalogue listing accepts.
 *
 * Mirrors `FilterState` in the mobile app (`features/products/filter-types.ts`),
 * which applied exactly these to the page it had already downloaded. That is
 * the reason they moved here: filtering one page of twenty out of a hundred and
 * twenty-four reorders that page and misreports every other product.
 *
 * Prices are **cents**, like everywhere else on this server; the controller
 * converts the euros a client sends.
 */
export interface CatalogFilters {
  sort?: CatalogSort;
  priceMinCents?: number;
  priceMaxCents?: number;
  /** 0 to 5. Products with no rating yet fall out once this is set. */
  minRating?: number;
  /**
   * Category UUIDs. **Resolved by the controller** — the service never sees a
   * slug, exactly like `listByCategory`, so this stays a single query.
   *
   * Only search uses it: a category page is already scoped by its route, and
   * that route is the one that gets indexed.
   */
  categoryIds?: string[];
  /**
   * `configurable` (sur mesure) or `standard` (prêt à poser). OR'd.
   *
   * ⚠️ `quote_only` is a live enum value with **zero rows**: migration 0012
   * moved every product off it and says none will be produced again. Parsing it
   * would be honest; offering it in a filter UI would not.
   */
  productTypes?: ProductType[];
  /**
   * Les cotes visees, en centimetres — « ce qui passe chez moi ».
   *
   * Bornees et arrondies par `parseFilters`, donc interpolables telles quelles
   * dans un `.or()` : PostgREST n'a pas de parametre lie, et ces deux nombres
   * sont la seule valeur de ce fichier qui finisse dans une chaine de filtre.
   */
  widthCm?: number;
  heightCm?: number;
}

/**
 * A PostgREST builder, narrowed to the chaining methods used below.
 *
 * The client's generics resolve to a different concrete type after every
 * `.eq()` / `.order()`, so a shared helper cannot be typed against one of them.
 * This is the shape they all have in common.
 */
interface FilterableQuery<T> {
  eq(column: string, value: unknown): T;
  gte(column: string, value: unknown): T;
  lte(column: string, value: unknown): T;
  in(column: string, values: readonly unknown[]): T;
  or(filters: string): T;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): T;
}

/**
 * Applies the price and rating narrowing.
 *
 * `price_sort_cents` is the generated column from migration 0045: the price the
 * customer actually reads on the card, which for a tiered per-m2 product is its
 * cheapest tier and not `price_per_sqm_cents` (the two disagree on 18 of the 67
 * tiered products). Filtering on anything else would drop products whose
 * displayed price sits inside the requested range.
 */
function applyFilters<T extends FilterableQuery<T>>(
  query: T,
  filters: CatalogFilters,
): T {
  let q = query;
  if (filters.priceMinCents != null) {
    q = q.gte('price_sort_cents', filters.priceMinCents);
  }
  if (filters.priceMaxCents != null) {
    q = q.lte('price_sort_cents', filters.priceMaxCents);
  }
  if (filters.minRating != null && filters.minRating > 0) {
    q = q.gte('rating_avg', filters.minRating);
  }
  // Empty arrays are skipped rather than passed through: `.in('x', [])` is a
  // valid PostgREST call that matches nothing, so an unknown category slug —
  // a shared URL that outlived a rename — would render "aucun produit" instead
  // of the unfiltered catalogue the forgiving-parse doctrine promises.
  if (filters.categoryIds?.length) {
    q = q.in('category_id', filters.categoryIds);
  }
  if (filters.productTypes?.length) {
    q = q.in('product_type', filters.productTypes);
  }
  q = applyCotes(q, filters);
  return q;
}

/**
 * « Fabricable a ces cotes » — le filtre qui correspond au metier.
 *
 * Le client de cette maison a deja mesure son ouverture ; c'est la question
 * qu'il pose vraiment, et jusqu'ici personne ne pouvait la poser.
 *
 * ── Trois decisions, toutes dictees par l'etat reel de la base ─────────────
 *
 * 1. `customizable = true` est impose. `dim_width` est NULL sur 120 des 125
 *    produits publies : il n'existe pas de cote fixe a comparer pour un produit
 *    pret a poser, et toute regle « a la tolerance pres » comparerait a des
 *    valeurs absentes, donc se comporterait au hasard.
 *
 * 2. Une borne NULL **passe**. Seize des soixante-et-onze produits sur mesure
 *    ont au moins une borne manquante ; une borne absente veut dire « pas de
 *    contrainte », pas « zero ». Les exclure cacherait un cinquieme de la gamme
 *    derriere un critere que le client croit seulement restrictif — et l'atelier
 *    verifie les cotes de toute facon, c'est le processus reel.
 *
 * 3. ⚠️ Les `.or()` repetes emettent des parametres `or=` repetes, que PostgREST
 *    combine en **ET**. C'est bien ce qu'on veut ici (la largeur ET la hauteur),
 *    et c'est exactement l'inverse de ce qu'on croit se rappeler.
 */
function applyCotes<T extends FilterableQuery<T>>(
  query: T,
  filters: CatalogFilters,
): T {
  let q = query;
  if (filters.widthCm == null && filters.heightCm == null) return q;

  q = q.eq('customizable', true);

  if (filters.widthCm != null) {
    q = q
      .or(`min_width.is.null,min_width.lte.${filters.widthCm}`)
      .or(`max_width.is.null,max_width.gte.${filters.widthCm}`);
  }
  if (filters.heightCm != null) {
    q = q
      .or(`min_height.is.null,min_height.lte.${filters.heightCm}`)
      .or(`max_height.is.null,max_height.gte.${filters.heightCm}`);
  }
  return q;
}

/**
 * Applies the ordering, and always a tiebreaker.
 *
 * Le depart n'est pas decoratif : PostgreSQL ne promet aucun ordre sans
 * `ORDER BY`, et deux produits partagent tres facilement une popularite ou un
 * prix. Sans second critere stable, deux pages successives peuvent renvoyer
 * deux fois la meme ligne et en sauter une autre — le defaut classique d'une
 * grille paginee, invisible sur vingt produits en developpement et
 * systematique en production.
 *
 * `search` ne triait rien du tout jusqu'ici ; il herite du meme ordre
 * deterministe, ce qui corrige ce defaut au passage.
 *
 * Les prix manquants vont en fin de liste dans les deux sens : un produit sans
 * prix (il en existe un, non vendable) n'a rien a faire en tete d'un tri par
 * prix croissant.
 */
function applySort<T extends FilterableQuery<T>>(query: T, sort: CatalogSort): T {
  switch (sort) {
    case 'recent':
      return query
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });
    case 'price_asc':
      return query
        .order('price_sort_cents', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true });
    case 'price_desc':
      return query
        .order('price_sort_cents', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true });
    case 'popular':
    default:
      return query
        .order('popularity', { ascending: false })
        .order('id', { ascending: true });
  }
}

@Injectable()
export class ProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Published products in a category, paginated, narrowed and ordered.
   *
   * `categoryId` is a real UUID here — the controller resolves a slug first, so
   * this stays a single query.
   *
   * With no `filters`, the ordering is popularity descending exactly as before
   * (plus an id tiebreaker), so the mobile app sees what it always saw.
   */
  async listByCategory(
    categoryId: string,
    page: number,
    limit: number,
    filters: CatalogFilters = {},
  ): Promise<PaginatedResponse<ProductDto>> {
    const { from, to } = pageRange(page, limit);

    const base = this.supabase.client
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .eq('category_id', categoryId)
      .eq('status', 'publie');

    const { data, count } = await applySort(
      applyFilters(base, filters),
      filters.sort ?? 'popular',
    )
      .range(from, to)
      .returns<ProductRow[]>();

    const items = (data ?? []).map(toProductDto);
    return buildPaginated(items, count ?? items.length, page, limit);
  }

  /**
   * A single published product, addressed by **UUID or slug**.
   *
   * The mobile app passes the id it received from a list; the storefront passes
   * the slug in its URL (`/boutique/p/:slug`), which is what makes that page
   * statically renderable and indexable. `products.slug` is `NOT NULL UNIQUE`,
   * so both forms resolve to at most one row.
   */
  async findOne(idOrSlug: string): Promise<ProductDto> {
    const { data } = await this.supabase.client
      .from('products')
      .select(PRODUCT_SELECT)
      .eq(identifierColumn(idOrSlug), idOrSlug)
      .maybeSingle<ProductRow>();
    if (!data) throw new NotFoundException('Produit introuvable');
    return toProductDto(data);
  }

  /**
   * Full-text search across published products, paginated and narrowed.
   *
   * ⚠️ The term goes through `normaliserTerme` before it reaches PostgREST.
   * Since migration 0048 the index holds unaccented lexemes only, and neither
   * PostgREST nor supabase-js unaccents the query — searching "cuisinière"
   * against an index storing "cuisiniere" would match nothing. The two
   * normalisations are held in agreement by `terme.util.spec.ts`.
   */
  async search(
    query: string,
    page: number,
    limit: number,
    filters: CatalogFilters = {},
  ): Promise<PaginatedResponse<ProductDto>> {
    const term = normaliserTerme(query);
    if (!term) return buildPaginated<ProductDto>([], 0, page, limit);

    const { from, to } = pageRange(page, limit);

    const base = this.supabase.client
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .eq('status', 'publie')
      .textSearch('search_tsv', term, { type: 'websearch', config: 'french' });

    const { data, count } = await applySort(
      applyFilters(base, filters),
      filters.sort ?? 'popular',
    )
      .range(from, to)
      .returns<ProductRow[]>();

    const items = (data ?? []).map(toProductDto);
    return buildPaginated(items, count ?? items.length, page, limit);
  }

  /**
   * Search-as-you-type: a handful of published products, in a small shape.
   *
   * ── Why this is not `search()` with a small limit ──────────────────────────
   * `search()` serialises `ProductDto`, which carries the description, the
   * configuration blocks and the whole embedded category — 7 to 10 KB per
   * product. At eight suggestions per keystroke that is 60-80 KB of payload for
   * a panel showing a thumbnail, a name and a price. `SUGGEST_SELECT` reads
   * only the columns that reach the screen.
   *
   * No `count: 'exact'`: nothing here paginates, and the count is a second
   * aggregate scan whose result would never be displayed.
   *
   * Ordering is popularity plus the id tiebreaker, like every other listing —
   * relevance ranking waits for `ts_rank_cd` over the weights migration 0048
   * laid down, which is a sort option and not a default.
   *
   * ⚠️ It takes the **same filters** as `search()`, and that is not a nicety.
   * The panel prints « 8 pièces passent à vos cotes » above this list: if the
   * cote filter did not reach the query, that sentence would be false, and the
   * list would show tiles under a heading claiming they fit a 240 × 120
   * opening. A count that lies is worse than no count.
   */
  async suggest(
    query: string,
    limit: number,
    filters: CatalogFilters = {},
  ): Promise<SuggestDto[]> {
    // Below two characters there is nothing to learn: against a French
    // catalogue of 125 products a single letter matches most of it after
    // stemming. Answering with an empty list costs no round trip, and the
    // caller treats it as "rien à proposer", never as an error — a debounce
    // race can legitimately deliver one stale character after a backspace.
    if (normaliserTerme(query).length < LONGUEUR_MIN_SUGGESTION) return [];

    // ⚠️ Prefix query, and not `websearch` like `search()`. Full-text search
    // matches whole stemmed words, so while the customer is still typing it
    // finds nothing: 'cuis' returns 0 where 'cuis:*' returns 59. See
    // `tsqueryPrefixe` for why the input is rebuilt rather than escaped.
    const requete = tsqueryPrefixe(query);
    if (!requete) return [];

    const base = this.supabase.client
      .from('products')
      .select(SUGGEST_SELECT)
      .eq('status', 'publie')
      .textSearch('search_tsv', requete, { config: 'french' });

    const { data } = await applySort(
      applyFilters(base, filters),
      filters.sort ?? 'popular',
    )
      .limit(Math.min(Math.max(1, limit), 10))
      .returns<SuggestRow[]>();

    return (data ?? []).map(toSuggestDto);
  }

  /**
   * The newest published products, in the suggestion shape.
   *
   * What the storefront's search panel shows while the field is still empty:
   * an empty field used to open on « 0 pièces trouvées », which reads as a
   * failed search the customer never ran. The latest additions are an honest
   * default — a fact about the catalogue, not a recommendation.
   *
   * Takes the same filters as `suggest()`, for the same reason: a cote posed
   * before any word is typed must still narrow the list the panel counts.
   */
  async latest(
    limit: number,
    filters: CatalogFilters = {},
  ): Promise<SuggestDto[]> {
    const base = this.supabase.client
      .from('products')
      .select(SUGGEST_SELECT)
      .eq('status', 'publie');

    const { data } = await applySort(applyFilters(base, filters), 'recent')
      .limit(Math.min(Math.max(1, limit), 10))
      .returns<SuggestRow[]>();

    return (data ?? []).map(toSuggestDto);
  }

  /**
   * How published prices are spread, for the storefront's price-range slider.
   *
   * ── Log-spaced buckets ───────────────────────────────────────────────────
   * The catalogue runs from 9 € to 2 500 € with a median of 190 €: linear
   * buckets would crush three quarters of it into the first two bars. The
   * client lays its slider on the same logarithmic scale, so a bar and the
   * handle above it always describe the same prices.
   *
   * `price_sort_cents` is the displayed price (migration 0045), the same column
   * the `priceMin` / `priceMax` filters read — the bars count exactly what the
   * filter would keep.
   */
  async priceHistogram(bucketCount = 28): Promise<PriceHistogramDto> {
    const { data } = await this.supabase.client
      .from('products')
      .select('price_sort_cents')
      .eq('status', 'publie')
      .gt('price_sort_cents', 0)
      .returns<{ price_sort_cents: number }[]>();

    const prices = (data ?? []).map((r) => r.price_sort_cents);
    if (prices.length === 0) {
      return { minCents: 0, maxCents: 0, avgCents: 0, buckets: [] };
    }

    const minCents = Math.min(...prices);
    const maxCents = Math.max(...prices);
    const lnMin = Math.log(minCents);
    const span = Math.log(maxCents) - lnMin;

    const buckets = new Array<number>(bucketCount).fill(0);
    for (const p of prices) {
      const i = span
        ? Math.min(bucketCount - 1, Math.floor(((Math.log(p) - lnMin) / span) * bucketCount))
        : 0;
      buckets[i] += 1;
    }

    const avgCents = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
    return { minCents, maxCents, avgCents, buckets };
  }

  /** Mobile: most popular published products. */
  async popular(limit: number): Promise<ProductDto[]> {
    const { data } = await this.supabase.client
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('status', 'publie')
      .order('popularity', { ascending: false })
      .limit(limit)
      .returns<ProductRow[]>();
    return (data ?? []).map(toProductDto);
  }

  /**
   * Mobile: fetch a specific set of published products by id (favorites,
   * featured). Results are returned in the same order as the requested ids.
   */
  async listByIds(ids: string[]): Promise<ProductDto[]> {
    if (ids.length === 0) return [];
    const { data } = await this.supabase.client
      .from('products')
      .select(PRODUCT_SELECT)
      .in('id', ids)
      .eq('status', 'publie')
      .returns<ProductRow[]>();
    const byId = new Map((data ?? []).map((r) => [r.id, toProductDto(r)]));
    return ids.map((id) => byId.get(id)).filter((p): p is ProductDto => !!p);
  }
}
