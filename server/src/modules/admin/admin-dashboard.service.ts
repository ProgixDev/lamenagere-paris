import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { centsToEuros } from '../../common/serialization/money.util';
import { fetchAllRows } from '../../common/serialization/pagination';

/**
 * How many rows each dashboard widget shows. These are display sizes, not data
 * limits — the surrounding totals are computed over the full table.
 */
const RECENT_ORDERS_SHOWN = 8;
const ACTIVITY_FEED_SHOWN = 12;
import {
  AdminOrderDto,
  ORDER_SELECT,
  OrderRow,
  toAdminOrderDto,
} from '../orders/orders.serializer';

export interface AdminStats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  pendingQuotes: number;
  unreadMessages: number;
}

export interface DashboardData {
  stats: AdminStats;
  revenueByDay: { date: string; total: number }[];
  categoryBreakdown: { category: string; total: number }[];
  recentOrders: AdminOrderDto[];
  activity: {
    id: string;
    kind: string;
    summary: string;
    createdAt: string;
    entityRef?: string;
  }[];
}

const PENDING_ORDER_STATUSES = [
  'commande_confirmee',
  'en_preparation',
  'en_attente_expedition',
];

@Injectable()
export class AdminDashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  async stats(): Promise<AdminStats> {
    const [orders, pendingOrders, quotes, convos] = await Promise.all([
      this.supabase.client
        .from('orders')
        .select('id', { count: 'exact', head: true }),
      this.supabase.client
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', PENDING_ORDER_STATUSES),
      this.supabase.client
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'en_attente_devis'),
      // Summed client-side, so every row has to be read — not just the first page.
      fetchAllRows<{ unread_admin: number }>((from, to) =>
        this.supabase.client
          .from('conversations')
          .select('unread_admin')
          .order('id', { ascending: true })
          .range(from, to)
          .returns<{ unread_admin: number }[]>(),
      ),
    ]);

    const revenueRows = await fetchAllRows<{ total_cents: number }>((from, to) =>
      this.supabase.client
        .from('orders')
        .select('total_cents')
        .order('id', { ascending: true })
        .range(from, to)
        .returns<{ total_cents: number }[]>(),
    );
    const totalRevenueCents = revenueRows.reduce(
      (sum, o) => sum + (o.total_cents ?? 0),
      0,
    );
    const unreadMessages = convos.reduce(
      (sum, c) => sum + (c.unread_admin ?? 0),
      0,
    );

    return {
      totalOrders: orders.count ?? 0,
      pendingOrders: pendingOrders.count ?? 0,
      totalRevenue: centsToEuros(totalRevenueCents),
      pendingQuotes: quotes.count ?? 0,
      unreadMessages,
    };
  }

  async dashboard(): Promise<DashboardData> {
    const stats = await this.stats();

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const orderRows = await fetchAllRows<{
      total_cents: number;
      created_at: string;
    }>((from, to) =>
      this.supabase.client
        .from('orders')
        .select('total_cents, created_at')
        .gte('created_at', since.toISOString())
        .order('id', { ascending: true })
        .range(from, to)
        .returns<{ total_cents: number; created_at: string }[]>(),
    );

    const byDay = new Map<string, number>();
    for (const o of orderRows) {
      const day = o.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + o.total_cents);
    }
    const revenueByDay = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cents]) => ({ date, total: centsToEuros(cents) }));

    // Category breakdown from order items joined to products -> categories.
    const itemRows = await fetchAllRows<{
      quantity: number;
      unit_price_cents: number;
      product: { category: { name: string } | null } | null;
    }>((from, to) =>
      this.supabase.client
        .from('order_items')
        .select(
          'quantity, unit_price_cents, product:products(category:categories(name))',
        )
        .order('id', { ascending: true })
        .range(from, to)
        .returns<
          {
            quantity: number;
            unit_price_cents: number;
            product: { category: { name: string } | null } | null;
          }[]
        >(),
    );
    const byCat = new Map<string, number>();
    for (const it of itemRows) {
      const name = it.product?.category?.name ?? 'Autres';
      byCat.set(name, (byCat.get(name) ?? 0) + it.unit_price_cents * it.quantity);
    }
    const categoryBreakdown = [...byCat.entries()]
      .map(([category, cents]) => ({ category, total: centsToEuros(cents) }))
      .sort((a, b) => b.total - a.total);

    const { data: recent } = await this.supabase.client
      .from('orders')
      .select(ORDER_SELECT)
      .order('created_at', { ascending: false })
      .limit(RECENT_ORDERS_SHOWN)
      .returns<OrderRow[]>();

    const { data: activity } = await this.supabase.client
      .from('activity_log')
      .select('id, kind, summary, entity_ref, created_at')
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_FEED_SHOWN)
      .returns<
        {
          id: string;
          kind: string;
          summary: string;
          entity_ref: string | null;
          created_at: string;
        }[]
      >();

    return {
      stats,
      revenueByDay,
      categoryBreakdown,
      recentOrders: (recent ?? []).map(toAdminOrderDto),
      activity: (activity ?? []).map((a) => ({
        id: a.id,
        kind: a.kind,
        summary: a.summary,
        entityRef: a.entity_ref ?? undefined,
        createdAt: a.created_at,
      })),
    };
  }
}
