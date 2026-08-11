import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { fetchAllRows } from '../../common/serialization/pagination';
import { ReorderPopupsDto, UpsertPopupDto } from './dto/popup-admin.dto';

/** Raw `app_popups` row; `toPopup` maps it to the DTO. */
interface PopupRow {
  id: string;
  position: number;
  [key: string]: unknown;
}

export interface AppPopupDto {
  id: string;
  title?: string;
  imageUrl: string;
  imagePath?: string;
  linkKind: 'none' | 'category' | 'product';
  linkCategoryId?: string;
  linkProductId?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  position: number;
}

@Injectable()
export class AdminPopupsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<AppPopupDto[]> {
    const data = await fetchAllRows<PopupRow>((from, to) =>
      this.supabase.client
        .from('app_popups')
        .select('*')
        .order('position', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
        .returns<PopupRow[]>(),
    );
    return data.map(this.toPopup);
  }

  /**
   * Active pop-ups currently inside their [starts_at, ends_at] window, ordered
   * for display. Served on the public storefront route; the mobile app shows
   * them one after another when the app opens.
   */
  async listActive(): Promise<AppPopupDto[]> {
    const nowIso = new Date().toISOString();
    const { data } = await this.supabase.client
      .from('app_popups')
      .select('*')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('position', { ascending: true });
    return (data ?? []).map(this.toPopup);
  }

  async create(dto: UpsertPopupDto): Promise<AppPopupDto> {
    const { count } = await this.supabase.client
      .from('app_popups')
      .select('id', { count: 'exact', head: true });
    const { data, error } = await this.supabase.client
      .from('app_popups')
      .insert(this.row(dto, count ?? 0))
      .select('*')
      .single();
    if (error || !data) throw new BadRequestException('Création impossible');
    return this.toPopup(data);
  }

  async update(id: string, dto: UpsertPopupDto): Promise<AppPopupDto> {
    const { data, error } = await this.supabase.client
      .from('app_popups')
      .update(this.row(dto))
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw new BadRequestException('Mise à jour impossible');
    return this.toPopup(data);
  }

  async remove(id: string): Promise<void> {
    await this.supabase.client.from('app_popups').delete().eq('id', id);
  }

  async reorder(dto: ReorderPopupsDto): Promise<void> {
    await Promise.all(
      dto.ids.map((id, position) =>
        this.supabase.client
          .from('app_popups')
          .update({ position })
          .eq('id', id),
      ),
    );
  }

  private row(dto: UpsertPopupDto, position?: number) {
    const linkKind = dto.linkKind ?? 'none';
    const row: Record<string, unknown> = {
      title: dto.title,
      image_url: dto.imageUrl,
      image_path: dto.imagePath,
      link_kind: linkKind,
      // Only keep the id matching the chosen link kind; clear the other.
      link_category_id: linkKind === 'category' ? dto.linkCategoryId : null,
      link_product_id: linkKind === 'product' ? dto.linkProductId : null,
      starts_at: dto.startsAt,
      ends_at: dto.endsAt,
      is_active: dto.isActive ?? true,
    };
    if (position != null) row.position = position;
    return row;
  }

  private toPopup = (r: any): AppPopupDto => ({
    id: r.id,
    title: r.title ?? undefined,
    imageUrl: r.image_url,
    imagePath: r.image_path ?? undefined,
    linkKind: r.link_kind,
    linkCategoryId: r.link_category_id ?? undefined,
    linkProductId: r.link_product_id ?? undefined,
    startsAt: r.starts_at ?? undefined,
    endsAt: r.ends_at ?? undefined,
    isActive: r.is_active,
    position: r.position,
  });
}
