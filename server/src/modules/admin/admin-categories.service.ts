import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  AdminCategoryDto,
  CATEGORY_SELECT,
  CategoryRow,
  toAdminCategoryDto,
} from '../catalog/catalog.serializer';
import { ReorderDto, UpsertCategoryDto } from './dto/category-admin.dto';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class AdminCategoriesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<AdminCategoryDto[]> {
    const { data } = await this.supabase.client
      .from('categories')
      .select(CATEGORY_SELECT)
      .order('sort_order', { ascending: true })
      .returns<CategoryRow[]>();
    const counts = await this.counts();
    return (data ?? []).map((r) => toAdminCategoryDto(r, counts.get(r.id) ?? 0));
  }

  async create(dto: UpsertCategoryDto): Promise<AdminCategoryDto> {
    const id = await this.upsert(dto, null);
    return this.getDto(id);
  }

  async update(id: string, dto: UpsertCategoryDto): Promise<AdminCategoryDto> {
    await this.getRow(id);
    await this.upsert(dto, id);
    return this.getDto(id);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) {
      throw new BadRequestException(
        'Suppression impossible (catégorie utilisée par des produits ?)',
      );
    }
  }

  async reorder(dto: ReorderDto): Promise<void> {
    await Promise.all(
      dto.ids.map((id, index) =>
        this.supabase.client
          .from('categories')
          .update({ sort_order: index })
          .eq('id', id),
      ),
    );
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private async upsert(
    dto: UpsertCategoryDto,
    id: string | null,
  ): Promise<string> {
    const row: Record<string, unknown> = {
      name: dto.name,
      slug: dto.slug?.trim() || slugify(dto.name),
      icon: dto.icon ?? '',
      description: dto.description,
      image_url: dto.imageUrl,
      accent_color: dto.accentColor,
      parent_id: dto.parentId,
      is_visible: dto.isVisible ?? true,
      is_featured_home: dto.isFeaturedHome ?? false,
      b2b_only: dto.b2bOnly ?? false,
      delivery_override: dto.deliveryOverride,
    };
    if (dto.sortOrder != null) row.sort_order = dto.sortOrder;
    if (id) row.id = id;

    const { data, error } = await this.supabase.client
      .from('categories')
      .upsert(row)
      .select('id')
      .single<{ id: string }>();
    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Enregistrement de la catégorie impossible',
      );
    }
    return data.id;
  }

  private async getRow(id: string): Promise<CategoryRow> {
    const { data } = await this.supabase.client
      .from('categories')
      .select(CATEGORY_SELECT)
      .eq('id', id)
      .maybeSingle<CategoryRow>();
    if (!data) throw new NotFoundException('Catégorie introuvable');
    return data;
  }

  private async getDto(id: string): Promise<AdminCategoryDto> {
    const row = await this.getRow(id);
    const counts = await this.counts();
    return toAdminCategoryDto(row, counts.get(id) ?? 0);
  }

  private async counts(): Promise<Map<string, number>> {
    const { data } = await this.supabase.client
      .from('products')
      .select('category_id')
      .returns<{ category_id: string }[]>();
    const counts = new Map<string, number>();
    for (const r of data ?? []) {
      counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
    }
    return counts;
  }
}
