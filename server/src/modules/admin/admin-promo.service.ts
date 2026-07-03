import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { UpsertPromoCodeDto } from './dto/promo-admin.dto';

interface PromoRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  product_id: string | null;
  min_order_cents: number | null;
  max_redemptions: number | null;
  per_customer_limit: number | null;
  times_redeemed: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  product?: { name: string } | null;
}

export interface AdminPromoCodeDto {
  id: string;
  code: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  productId?: string;
  productName?: string;
  minOrderCents?: number;
  maxRedemptions?: number;
  perCustomerLimit?: number;
  timesRedeemed: number;
  startsAt?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

const SELECT = '*, product:products(name)';

@Injectable()
export class AdminPromoService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<AdminPromoCodeDto[]> {
    const { data } = await this.supabase.client
      .from('promo_codes')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .returns<PromoRow[]>();
    return (data ?? []).map(toDto);
  }

  async create(dto: UpsertPromoCodeDto): Promise<AdminPromoCodeDto> {
    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .insert(toRow(dto))
      .select(SELECT)
      .single<PromoRow>();
    if (error || !data) throw fail(error?.message);
    return toDto(data);
  }

  async update(id: string, dto: UpsertPromoCodeDto): Promise<AdminPromoCodeDto> {
    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .update(toRow(dto))
      .eq('id', id)
      .select(SELECT)
      .single<PromoRow>();
    if (error || !data) throw fail(error?.message);
    return toDto(data);
  }

  async remove(id: string): Promise<void> {
    await this.supabase.client.from('promo_codes').delete().eq('id', id);
  }
}

function toRow(dto: UpsertPromoCodeDto) {
  if (dto.discountType === 'percent' && dto.discountValue > 100) {
    throw new BadRequestException('Un pourcentage ne peut pas dépasser 100');
  }
  return {
    code: dto.code.trim().toUpperCase(),
    description: dto.description?.trim() || null,
    discount_type: dto.discountType,
    discount_value: dto.discountValue,
    product_id: dto.productId || null,
    min_order_cents: dto.minOrderCents ?? null,
    max_redemptions: dto.maxRedemptions ?? null,
    per_customer_limit: dto.perCustomerLimit ?? null,
    starts_at: dto.startsAt || null,
    expires_at: dto.expiresAt || null,
    is_active: dto.isActive ?? true,
  };
}

function toDto(r: PromoRow): AdminPromoCodeDto {
  return {
    id: r.id,
    code: r.code,
    description: r.description ?? undefined,
    discountType: r.discount_type,
    discountValue: r.discount_value,
    productId: r.product_id ?? undefined,
    productName: r.product?.name ?? undefined,
    minOrderCents: r.min_order_cents ?? undefined,
    maxRedemptions: r.max_redemptions ?? undefined,
    perCustomerLimit: r.per_customer_limit ?? undefined,
    timesRedeemed: r.times_redeemed,
    startsAt: r.starts_at ?? undefined,
    expiresAt: r.expires_at ?? undefined,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

function fail(message?: string) {
  // Surface the Postgres unique-violation on `code` as a friendly message.
  if (message && /duplicate key|unique/i.test(message)) {
    return new BadRequestException('Ce code existe déjà');
  }
  return new BadRequestException(message ?? 'Enregistrement impossible');
}
