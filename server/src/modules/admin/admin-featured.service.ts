import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  PRODUCT_SELECT,
  ProductDto,
  ProductRow,
  toProductDto,
} from '../catalog/catalog.serializer';
import {
  AddFeaturedDto,
  ReorderDto,
  UpsertBannerDto,
  UpsertSlideDto,
} from './dto/featured-admin.dto';

export interface CarouselSlideDto {
  id: string;
  kind: 'image' | 'video';
  title: string;
  subtitle?: string;
  mediaUrl: string;
  linkKind: 'none' | 'category' | 'product';
  linkCategoryId?: string;
  linkProductId?: string;
  isActive: boolean;
  position: number;
}

export interface PromoBannerDto {
  id: string;
  badge?: string;
  title: string;
  subtitle?: string;
  style?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  position: number;
}

@Injectable()
export class AdminFeaturedService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── featured products ──────────────────────────────────────────────────────
  // A null categoryId targets the global home rail; a set categoryId targets
  // that category's curated rail. Scope helpers keep the two rails independent.
  private scopeCategory<T extends { eq: any; is: any }>(
    query: T,
    categoryId?: string,
  ): T {
    return categoryId
      ? query.eq('category_id', categoryId)
      : query.is('category_id', null);
  }

  async listFeatured(categoryId?: string): Promise<ProductDto[]> {
    const { data } = await this.scopeCategory(
      this.supabase.client
        .from('featured_products')
        .select(`position, product:products(${PRODUCT_SELECT})`),
      categoryId,
    )
      .order('position', { ascending: true })
      .returns<{ position: number; product: ProductRow | null }[]>();
    return (data ?? [])
      .map((r) => r.product)
      .filter((p): p is ProductRow => !!p)
      .map(toProductDto);
  }

  /** Public per-category "Notre sélection" rail (published products only). */
  async listFeaturedForCategory(categoryId: string): Promise<ProductDto[]> {
    const { data } = await this.supabase.client
      .from('featured_products')
      .select(`position, product:products(${PRODUCT_SELECT})`)
      .eq('category_id', categoryId)
      .order('position', { ascending: true })
      .returns<{ position: number; product: ProductRow | null }[]>();
    return (data ?? [])
      .map((r) => r.product)
      .filter((p): p is ProductRow => !!p && p.status === 'publie')
      .map(toProductDto);
  }

  async addFeatured(dto: AddFeaturedDto): Promise<void> {
    const categoryId = dto.categoryId;
    const { count } = await this.scopeCategory(
      this.supabase.client
        .from('featured_products')
        .select('id', { count: 'exact', head: true }),
      categoryId,
    );
    const { data: existing } = await this.scopeCategory(
      this.supabase.client
        .from('featured_products')
        .select('id')
        .eq('product_id', dto.productId),
      categoryId,
    ).maybeSingle();
    if (existing) return; // already in this rail
    const { error } = await this.supabase.client
      .from('featured_products')
      .insert({
        product_id: dto.productId,
        category_id: categoryId ?? null,
        position: count ?? 0,
      });
    if (error) throw new BadRequestException('Ajout impossible');
  }

  async removeFeatured(productId: string, categoryId?: string): Promise<void> {
    await this.scopeCategory(
      this.supabase.client
        .from('featured_products')
        .delete()
        .eq('product_id', productId),
      categoryId,
    );
  }

  async reorderFeatured(dto: ReorderDto): Promise<void> {
    await Promise.all(
      dto.ids.map((productId, position) =>
        this.scopeCategory(
          this.supabase.client
            .from('featured_products')
            .update({ position })
            .eq('product_id', productId),
          dto.categoryId,
        ),
      ),
    );
  }

  // ── carousel ───────────────────────────────────────────────────────────────
  async listSlides(): Promise<CarouselSlideDto[]> {
    const { data } = await this.supabase.client
      .from('carousel_slides')
      .select('*')
      .order('position', { ascending: true });
    return (data ?? []).map(this.toSlide);
  }

  async createSlide(dto: UpsertSlideDto): Promise<CarouselSlideDto> {
    const { count } = await this.supabase.client
      .from('carousel_slides')
      .select('id', { count: 'exact', head: true });
    const { data, error } = await this.supabase.client
      .from('carousel_slides')
      .insert(this.slideRow(dto, count ?? 0))
      .select('*')
      .single();
    if (error || !data) throw new BadRequestException('Création impossible');
    return this.toSlide(data);
  }

  async updateSlide(id: string, dto: UpsertSlideDto): Promise<CarouselSlideDto> {
    const { data, error } = await this.supabase.client
      .from('carousel_slides')
      .update(this.slideRow(dto))
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw new BadRequestException('Mise à jour impossible');
    return this.toSlide(data);
  }

  async deleteSlide(id: string): Promise<void> {
    await this.supabase.client.from('carousel_slides').delete().eq('id', id);
  }

  // ── banners ────────────────────────────────────────────────────────────────
  async listBanners(): Promise<PromoBannerDto[]> {
    const { data } = await this.supabase.client
      .from('promo_banners')
      .select('*')
      .order('position', { ascending: true });
    return (data ?? []).map(this.toBanner);
  }

  async createBanner(dto: UpsertBannerDto): Promise<PromoBannerDto> {
    const { count } = await this.supabase.client
      .from('promo_banners')
      .select('id', { count: 'exact', head: true });
    const { data, error } = await this.supabase.client
      .from('promo_banners')
      .insert(this.bannerRow(dto, count ?? 0))
      .select('*')
      .single();
    if (error || !data) throw new BadRequestException('Création impossible');
    return this.toBanner(data);
  }

  async updateBanner(id: string, dto: UpsertBannerDto): Promise<PromoBannerDto> {
    const { data, error } = await this.supabase.client
      .from('promo_banners')
      .update(this.bannerRow(dto))
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw new BadRequestException('Mise à jour impossible');
    return this.toBanner(data);
  }

  async deleteBanner(id: string): Promise<void> {
    await this.supabase.client.from('promo_banners').delete().eq('id', id);
  }

  // ── public home payload (carousel + banners + featured) ─────────────────────
  async home() {
    const [featured, slides, banners] = await Promise.all([
      this.listFeatured(),
      this.supabase.client
        .from('carousel_slides')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true }),
      this.supabase.client
        .from('promo_banners')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true }),
    ]);
    return {
      featured,
      carousel: (slides.data ?? []).map(this.toSlide),
      banners: (banners.data ?? []).map(this.toBanner),
    };
  }

  // ── mappers ────────────────────────────────────────────────────────────────
  private slideRow(dto: UpsertSlideDto, position?: number) {
    const row: Record<string, unknown> = {
      kind: dto.kind,
      title: dto.title,
      subtitle: dto.subtitle,
      media_url: dto.mediaUrl,
      link_kind: dto.linkKind ?? 'none',
      link_category_id: dto.linkCategoryId,
      link_product_id: dto.linkProductId,
      is_active: dto.isActive ?? true,
    };
    if (position != null) row.position = position;
    return row;
  }

  private bannerRow(dto: UpsertBannerDto, position?: number) {
    const row: Record<string, unknown> = {
      badge: dto.badge,
      title: dto.title,
      subtitle: dto.subtitle,
      style: dto.style,
      starts_at: dto.startsAt,
      ends_at: dto.endsAt,
      is_active: dto.isActive ?? true,
    };
    if (position != null) row.position = position;
    return row;
  }

  private toSlide = (r: any): CarouselSlideDto => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    subtitle: r.subtitle ?? undefined,
    mediaUrl: r.media_url,
    linkKind: r.link_kind,
    linkCategoryId: r.link_category_id ?? undefined,
    linkProductId: r.link_product_id ?? undefined,
    isActive: r.is_active,
    position: r.position,
  });

  private toBanner = (r: any): PromoBannerDto => ({
    id: r.id,
    badge: r.badge ?? undefined,
    title: r.title,
    subtitle: r.subtitle ?? undefined,
    style: r.style ?? undefined,
    startsAt: r.starts_at ?? undefined,
    endsAt: r.ends_at ?? undefined,
    isActive: r.is_active,
    position: r.position,
  });
}
