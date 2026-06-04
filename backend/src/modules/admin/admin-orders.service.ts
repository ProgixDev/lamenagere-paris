import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { formatEURFromCents } from '../../common/serialization/money.util';
import {
  orderStatusLabel,
  OrderStatus,
} from '../../common/serialization/status-labels';
import {
  buildPaginated,
  PaginatedResponse,
  pageRange,
} from '../../common/serialization/pagination';
import {
  AdminOrderDto,
  ORDER_SELECT,
  OrderDto,
  OrderRow,
  toAdminOrderDto,
  toOrderDto,
} from '../orders/orders.serializer';
import {
  AddOrderNoteDto,
  OrderListQuery,
  ShipOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
} from './dto/order-admin.dto';

export interface AdminOrderDetail {
  order: OrderDto;
  client: { id: string; name: string; accountType: string } | null;
  notes: { id: string; body: string; createdAt: string }[];
}

@Injectable()
export class AdminOrdersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(query: OrderListQuery): Promise<PaginatedResponse<AdminOrderDto>> {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const { from, to } = pageRange(page, limit);

    let q = this.supabase.client.from('orders').select(ORDER_SELECT, {
      count: 'exact',
    });
    if (query.status) q = q.eq('status', query.status);
    if (query.territory) q = q.eq('territory', query.territory);
    if (query.q && query.q.trim()) {
      q = q.ilike('order_number', `%${query.q.trim()}%`);
    }

    const { data, count } = await q
      .order('created_at', { ascending: false })
      .range(from, to)
      .returns<OrderRow[]>();

    let rows = data ?? [];
    if (query.accountType === 'professionnel') rows = rows.filter((r) => r.is_b2b);
    if (query.accountType === 'particulier') rows = rows.filter((r) => !r.is_b2b);

    return buildPaginated(
      rows.map(toAdminOrderDto),
      count ?? rows.length,
      page,
      limit,
    );
  }

  async detail(idOrNumber: string): Promise<AdminOrderDetail> {
    const row = await this.loadByIdOrNumber(idOrNumber);
    const { data: notes } = await this.supabase.client
      .from('order_notes')
      .select('id, body, created_at')
      .eq('order_id', row.id)
      .order('created_at', { ascending: false })
      .returns<{ id: string; body: string; created_at: string }[]>();

    return {
      order: toOrderDto(row),
      client: row.profile
        ? {
            id: row.profile_id,
            name: [row.profile.first_name, row.profile.last_name]
              .filter(Boolean)
              .join(' '),
            accountType: row.profile.account_type,
          }
        : null,
      notes: (notes ?? []).map((n) => ({
        id: n.id,
        body: n.body,
        createdAt: n.created_at,
      })),
    };
  }

  async setStatus(
    idOrNumber: string,
    dto: UpdateOrderStatusDto,
  ): Promise<AdminOrderDto> {
    const row = await this.loadByIdOrNumber(idOrNumber);
    await this.supabase.client
      .from('orders')
      .update({ status: dto.status })
      .eq('id', row.id);
    await this.appendTimeline(row.id, dto.status, dto.note);
    return toAdminOrderDto(await this.loadByIdOrNumber(idOrNumber));
  }

  async ship(idOrNumber: string, dto: ShipOrderDto): Promise<AdminOrderDto> {
    const row = await this.loadByIdOrNumber(idOrNumber);
    await this.supabase.client
      .from('orders')
      .update({
        status: 'expediee',
        carrier: dto.carrier,
        tracking_number: dto.trackingNumber,
        tracking_url: dto.trackingUrl,
      })
      .eq('id', row.id);
    await this.appendTimeline(
      row.id,
      'expediee',
      `${dto.carrier} — ${dto.trackingNumber}`,
    );
    return toAdminOrderDto(await this.loadByIdOrNumber(idOrNumber));
  }

  async update(idOrNumber: string, dto: UpdateOrderDto): Promise<AdminOrderDto> {
    const row = await this.loadByIdOrNumber(idOrNumber);
    const patch: Record<string, unknown> = {};
    if (dto.estimatedDelivery !== undefined) {
      patch.estimated_delivery = dto.estimatedDelivery;
    }
    if (Object.keys(patch).length) {
      await this.supabase.client.from('orders').update(patch).eq('id', row.id);
    }
    return toAdminOrderDto(await this.loadByIdOrNumber(idOrNumber));
  }

  async addNote(
    idOrNumber: string,
    authorId: string,
    dto: AddOrderNoteDto,
  ): Promise<{ id: string; body: string; createdAt: string }> {
    const row = await this.loadByIdOrNumber(idOrNumber);
    const { data, error } = await this.supabase.client
      .from('order_notes')
      .insert({ order_id: row.id, author_id: authorId, body: dto.body })
      .select('id, body, created_at')
      .single<{ id: string; body: string; created_at: string }>();
    if (error || !data) throw new BadRequestException('Ajout de note impossible');
    return { id: data.id, body: data.body, createdAt: data.created_at };
  }

  /** Refund is deferred (Stripe). Records intent on the timeline only. */
  async refund(idOrNumber: string): Promise<{ status: string }> {
    const row = await this.loadByIdOrNumber(idOrNumber);
    await this.supabase.client.from('order_notes').insert({
      order_id: row.id,
      body: 'Remboursement demandé (intégration Stripe à venir).',
    });
    return { status: 'pending_refund' };
  }

  async exportCsv(): Promise<string> {
    const { data } = await this.supabase.client
      .from('orders')
      .select(ORDER_SELECT)
      .order('created_at', { ascending: false })
      .returns<OrderRow[]>();
    const header = 'order_number,client,total,status,territory,created_at';
    const lines = (data ?? []).map((r) => {
      const dto = toAdminOrderDto(r);
      return [
        dto.id,
        `"${dto.client}"`,
        formatEURFromCents(r.total_cents),
        dto.status,
        dto.territory,
        r.created_at,
      ].join(',');
    });
    return [header, ...lines].join('\n');
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private async appendTimeline(
    orderId: string,
    status: OrderStatus,
    note?: string,
  ): Promise<void> {
    await this.supabase.client.from('order_timeline').insert({
      order_id: orderId,
      status,
      label: orderStatusLabel(status),
      note,
      completed: true,
      occurred_at: new Date().toISOString(),
    });
  }

  private async loadByIdOrNumber(idOrNumber: string): Promise<OrderRow> {
    const column = idOrNumber.startsWith('LMP-') ? 'order_number' : 'id';
    const { data } = await this.supabase.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq(column, idOrNumber)
      .maybeSingle<OrderRow>();
    if (!data) throw new NotFoundException('Commande introuvable');
    return data;
  }
}
