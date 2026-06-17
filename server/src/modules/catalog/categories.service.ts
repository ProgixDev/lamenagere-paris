import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  CATEGORY_SELECT,
  CategoryDto,
  CategoryRow,
  toCategoryDto,
} from './catalog.serializer';

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

  async findByIdOrThrow(id: string): Promise<CategoryRow> {
    const { data } = await this.supabase.client
      .from('categories')
      .select(CATEGORY_SELECT)
      .eq('id', id)
      .maybeSingle<CategoryRow>();
    if (!data) throw new NotFoundException('Catégorie introuvable');
    return data;
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
