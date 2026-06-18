import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  buildPaginated,
  PaginatedResponse,
  pageRange,
} from '../../common/serialization/pagination';
import {
  PRODUCT_SELECT,
  ProductDto,
  ProductRow,
  toProductDto,
} from './catalog.serializer';

@Injectable()
export class ProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Mobile: published products in a category, paginated. */
  async listByCategory(
    categoryId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<ProductDto>> {
    const { from, to } = pageRange(page, limit);
    const { data, count } = await this.supabase.client
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .eq('category_id', categoryId)
      .eq('status', 'publie')
      .order('popularity', { ascending: false })
      .range(from, to)
      .returns<ProductRow[]>();

    const items = (data ?? []).map(toProductDto);
    return buildPaginated(items, count ?? items.length, page, limit);
  }

  /** Mobile: single published product. */
  async findOne(id: string): Promise<ProductDto> {
    const { data } = await this.supabase.client
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', id)
      .maybeSingle<ProductRow>();
    if (!data) throw new NotFoundException('Produit introuvable');
    return toProductDto(data);
  }

  /** Mobile: full-text search across published products, paginated. */
  async search(
    query: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<ProductDto>> {
    const term = query.trim();
    if (!term) return buildPaginated<ProductDto>([], 0, page, limit);

    const { from, to } = pageRange(page, limit);
    const { data, count } = await this.supabase.client
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .eq('status', 'publie')
      .textSearch('search_tsv', term, { type: 'websearch', config: 'french' })
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
