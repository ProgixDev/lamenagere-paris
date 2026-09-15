import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  CATEGORY_SELECT,
  CategoryDto,
  CategoryRow,
  toCategoryDto,
} from './catalog.serializer';
import { identifierColumn } from '../../common/serialization/identifier.util';

@Injectable()
export class CategoriesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Mobile: visible categories with published-product counts. */
  async listVisible(): Promise<CategoryDto[]> {
    const { data } = await this.supabase.client
      .from('categories')
      .select(CATEGORY_SELECT)
      .eq('is_visible', true)
      .order('sort_order', { ascending: true })
      .returns<CategoryRow[]>();

    const rows = data ?? [];
    const counts = await this.publishedCounts();
    return rows.map((r) => toCategoryDto(r, counts.get(r.id) ?? 0));
  }

  /**
   * A category, addressed by **UUID or slug**.
   *
   * The storefront's category pages are `/boutique/cuisines`, so the slug is
   * the only identifier it has. `categories.slug` is `NOT NULL UNIQUE`.
   */
  async findByIdOrThrow(idOrSlug: string): Promise<CategoryRow> {
    const { data } = await this.supabase.client
      .from('categories')
      .select(CATEGORY_SELECT)
      .eq(identifierColumn(idOrSlug), idOrSlug)
      .maybeSingle<CategoryRow>();
    if (!data) throw new NotFoundException('Catégorie introuvable');
    return data;
  }

  /**
   * Resolves a public `:id` path parameter to the row's UUID.
   *
   * A UUID is returned untouched — deliberately without a lookup, so the
   * mobile app's existing calls keep exactly the shape and cost they had. Only
   * a slug, which only the storefront sends, pays for the extra query.
   */
  async resolveId(idOrSlug: string): Promise<string> {
    if (identifierColumn(idOrSlug) === 'id') return idOrSlug;
    return (await this.findByIdOrThrow(idOrSlug)).id;
  }

  /**
   * Slugs (or UUIDs) to UUIDs, for the search's `?cat=` facet.
   *
   * ── Why this doesn't 404 like `resolveId` does ─────────────────────────────
   * `resolveId` serves a category *page*: an unknown slug there means the page
   * does not exist, and 404 is the right answer. This serves a *filter* on a
   * search-results URL, which is bookmarked, shared and hand-edited. A slug
   * that outlived a rename should narrow the search to what still exists, not
   * turn a shared link into an error page.
   *
   * An empty input short-circuits, and a set of slugs that resolves to nothing
   * returns an empty array — the caller must treat that as "no category
   * narrowing", never as `.in('category_id', [])`, which matches no rows.
   */
  async resolveIds(idsOrSlugs: string[]): Promise<string[]> {
    if (idsOrSlugs.length === 0) return [];

    const uuids = idsOrSlugs.filter((v) => identifierColumn(v) === 'id');
    const slugs = idsOrSlugs.filter((v) => identifierColumn(v) !== 'id');
    if (slugs.length === 0) return uuids;

    const { data } = await this.supabase.client
      .from('categories')
      .select('id')
      .in('slug', slugs)
      .returns<{ id: string }[]>();

    return [...new Set([...uuids, ...(data ?? []).map((r) => r.id)])];
  }

  /** Map of category_id -> count of published products. */
  private async publishedCounts(): Promise<Map<string, number>> {
    const { data } = await this.supabase.client
      .from('products')
      .select('category_id')
      .eq('status', 'publie')
      .returns<{ category_id: string }[]>();
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
    return counts;
  }
}
