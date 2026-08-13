import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { eurosToCents } from '../../common/serialization/money.util';
import { DEFAULT_AREA_FORMULA } from '../../common/pricing/area-formulas';
import {
  buildPaginated,
  clampLimit,
  fetchAllRows,
  PaginatedResponse,
  pageRange,
} from '../../common/serialization/pagination';
import {
  AdminProductDto,
  PRODUCT_SELECT,
  ProductRow,
  toAdminProductDto,
} from '../catalog/catalog.serializer';
import {
  BulkActionDto,
  ProductStatus,
  UpsertProductDto,
} from './dto/product-admin.dto';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class AdminProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(opts: {
    page: number;
    limit: number;
    status?: ProductStatus;
    categoryId?: string;
    q?: string;
  }): Promise<PaginatedResponse<AdminProductDto>> {
    const limit = clampLimit(opts.limit, 20);
    const { from, to } = pageRange(opts.page, limit);
    let query = this.supabase.client
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' });

    if (opts.status) query = query.eq('status', opts.status);
    if (opts.categoryId) query = query.eq('category_id', opts.categoryId);
    if (opts.q && opts.q.trim()) {
      const term = opts.q.trim().replace(/[%,]/g, '');
      query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
    }

    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)
      .returns<ProductRow[]>();

    const items = (data ?? []).map(toAdminProductDto);
    return buildPaginated(items, count ?? items.length, opts.page, limit);
  }

  /**
   * Status + per-category tallies over the WHOLE catalogue, so the admin list
   * can show honest filter counts while only rendering one page at a time.
   * Respects `q` so the counts track an active search.
   */
  async facets(q?: string): Promise<{
    total: number;
    byStatus: Record<ProductStatus, number>;
    byCategory: { categoryId: string; count: number }[];
  }> {
    const term = q?.trim() ? q.trim().replace(/[%,]/g, '') : null;

    const rows = await fetchAllRows<{
      status: ProductStatus;
      category_id: string;
    }>((from, to) => {
      let query = this.supabase.client
        .from('products')
        .select('status, category_id');
      if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
      return query
        .order('id', { ascending: true })
        .range(from, to)
        .returns<{ status: ProductStatus; category_id: string }[]>();
    });

    const byStatus: Record<ProductStatus, number> = {
      publie: 0,
      brouillon: 0,
      archive: 0,
    };
    const byCategory = new Map<string, number>();
    for (const r of rows) {
      if (r.status in byStatus) byStatus[r.status] += 1;
      byCategory.set(r.category_id, (byCategory.get(r.category_id) ?? 0) + 1);
    }

    return {
      total: rows.length,
      byStatus,
      byCategory: [...byCategory.entries()].map(([categoryId, count]) => ({
        categoryId,
        count,
      })),
    };
  }

  async getRaw(id: string): Promise<ProductRow> {
    // Full column set (+ relations) so the admin edit form round-trips every
    // field, not just the catalog subset in PRODUCT_SELECT.
    const { data } = await this.supabase.client
      .from('products')
      .select('*, category:categories(*), media:product_media(*)')
      .eq('id', id)
      .maybeSingle<ProductRow>();
    if (!data) throw new NotFoundException('Produit introuvable');
    return data;
  }

  async create(dto: UpsertProductDto): Promise<AdminProductDto> {
    const id = await this.upsertRow(dto, null);
    await this.replaceMedia(id, dto);
    return toAdminProductDto(await this.getRaw(id));
  }

  async update(id: string, dto: UpsertProductDto): Promise<AdminProductDto> {
    await this.getRaw(id); // existence check
    await this.upsertRow(dto, id);
    if (dto.imageUrls || dto.videoUrls) await this.replaceMedia(id, dto);
    return toAdminProductDto(await this.getRaw(id));
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException('Suppression impossible');
  }

  async setStatus(id: string, status: ProductStatus): Promise<AdminProductDto> {
    const patch: Record<string, unknown> = { status };
    if (status === 'publie') patch.published_at = new Date().toISOString();
    const { error } = await this.supabase.client
      .from('products')
      .update(patch)
      .eq('id', id);
    if (error) throw new BadRequestException('Changement de statut impossible');
    return toAdminProductDto(await this.getRaw(id));
  }

  async bulk(dto: BulkActionDto): Promise<{ affected: number }> {
    if (dto.ids.length === 0) return { affected: 0 };
    if (dto.action === 'delete') {
      await this.supabase.client.from('products').delete().in('id', dto.ids);
      return { affected: dto.ids.length };
    }
    const statusMap: Record<string, ProductStatus> = {
      publish: 'publie',
      draft: 'brouillon',
      archive: 'archive',
    };
    await this.supabase.client
      .from('products')
      .update({ status: statusMap[dto.action] })
      .in('id', dto.ids);
    return { affected: dto.ids.length };
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private async upsertRow(
    dto: UpsertProductDto,
    id: string | null,
  ): Promise<string> {
    const row: Record<string, unknown> = {
      name: dto.name,
      slug: dto.slug?.trim() || slugify(dto.name),
      sku: dto.sku,
      description: dto.description ?? '',
      short_description: dto.shortDescription,
      category_id: dto.categoryId,
      product_type: dto.productType,
      price_mode: dto.priceMode,
      status: dto.status ?? 'brouillon',
      base_price_cents: dto.price != null ? eurosToCents(dto.price) : null,
      purchase_cost_cents:
        dto.purchaseCost != null ? eurosToCents(dto.purchaseCost) : null,
      width_coef_cents: dto.widthCoef != null ? eurosToCents(dto.widthCoef) : null,
      height_coef_cents:
        dto.heightCoef != null ? eurosToCents(dto.heightCoef) : null,
      price_per_sqm_cents:
        dto.pricePerSqm != null ? eurosToCents(dto.pricePerSqm) : null,
      // `opening_types` is no longer written: openings are configured as an
      // `opening_details` block. Legacy values stay in the column, unread.
      quality_tiers: (dto.qualityTiers ?? []).map((t) => ({
        key: t.key,
        label: t.label,
        price_per_sqm_cents: eurosToCents(t.pricePerSqm ?? 0),
      })),
      // upsertRow writes every column, so an omitted formula must fall back to
      // the default rather than nulling a product's existing choice.
      area_formula: dto.areaFormula ?? DEFAULT_AREA_FORMULA,
      dim_width: dto.dimWidth,
      dim_height: dto.dimHeight,
      dim_depth: dto.dimDepth,
      ref_width: dto.refWidth,
      ref_height: dto.refHeight,
      min_width: dto.minWidth,
      min_height: dto.minHeight,
      max_width: dto.maxWidth,
      max_height: dto.maxHeight,
      customizable: dto.customizable ?? false,
      delivery_metropole: dto.deliveryMetropole ?? '2-3 semaines',
      delivery_outremer: dto.deliveryOutremer ?? '8-12 semaines',
      weight_kg: dto.weightKg,
      volume_m3: dto.volumeM3,
      free_shipping: dto.freeShipping ?? false,
      stock_qty: dto.stockQty,
      low_stock_threshold: dto.lowStockThreshold,
      max_per_order: dto.maxPerOrder,
      seo_title: dto.seoTitle,
      seo_description: dto.seoDescription,
      // Empty/omitted → null so the product inherits its category template.
      config_blocks: dto.configBlocks?.length ? dto.configBlocks : null,
      // Colour variants; drop rows missing a name, keep the rest as-is.
      colors: dto.colors?.length
        ? dto.colors
            .filter((c) => c.name?.trim())
            .map((c) => ({
              key: c.key?.trim() || slugify(c.name),
              name: c.name.trim(),
              hex: c.hex?.trim() || undefined,
              images: c.images ?? [],
            }))
        : null,
    };
    if (id) row.id = id;

    const { data, error } = await this.supabase.client
      .from('products')
      .upsert(row)
      .select('id')
      .single<{ id: string }>();
    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Enregistrement du produit impossible',
      );
    }
    return data.id;
  }

  private async replaceMedia(id: string, dto: UpsertProductDto): Promise<void> {
    if (!dto.imageUrls && !dto.videoUrls) return;
    await this.supabase.client
      .from('product_media')
      .delete()
      .eq('product_id', id);

    const rows: Record<string, unknown>[] = [];
    (dto.imageUrls ?? []).forEach((url, i) =>
      rows.push({
        product_id: id,
        type: 'image',
        url,
        sort_order: i,
        is_primary: i === 0,
      }),
    );
    (dto.videoUrls ?? []).forEach((url, i) =>
      rows.push({ product_id: id, type: 'video', url, sort_order: i }),
    );
    if (rows.length) {
      await this.supabase.client.from('product_media').insert(rows);
    }
  }
}
