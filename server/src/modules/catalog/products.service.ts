import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  buildPaginated,
  PaginatedResponse,
  pageRange,
} from '../../common/serialization/pagination';
import { identifierColumn } from '../../common/serialization/identifier.util';
import {
  PRODUCT_SELECT,
  ProductDto,
  ProductRow,
  toProductDto,
} from './catalog.serializer';

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
}

/**
 * A PostgREST builder, narrowed to the chaining methods used below.
 *
 * The client's generics resolve to a different concrete type after every
 * `.eq()` / `.order()`, so a shared helper cannot be typed against one of them.
 * This is the shape they all have in common.
 */
interface FilterableQuery<T> {
  gte(column: string, value: unknown): T;
  lte(column: string, value: unknown): T;
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

  /** Full-text search across published products, paginated and narrowed. */
  async search(
    query: string,
    page: number,
    limit: number,
    filters: CatalogFilters = {},
  ): Promise<PaginatedResponse<ProductDto>> {
    const term = query.trim();
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
