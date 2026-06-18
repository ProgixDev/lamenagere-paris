import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { centsToEuros } from '../../common/serialization/money.util';
import {
  orderStatusLabel,
  OrderStatus,
} from '../../common/serialization/status-labels';

const DAY = 86400000;

interface AnalyticsOrderRow {
  total_cents: number;
  territory: string;
  status: OrderStatus;
  created_at: string;
  profile_id: string;
  profile: { full_name: string } | null;
  items: {
    quantity: number;
    unit_price_cents: number;
    product_id: string | null;
    product_name: string;
    product_image: string | null;
    product: { category: { name: string } | null } | null;
  }[];
}

const ANALYTICS_SELECT =
  'total_cents, territory, status, created_at, profile_id, profile:profiles(full_name), items:order_items(quantity, unit_price_cents, product_id, product_name, product_image, product:products(category:categories(name)))';

interface Totals {
  revenueCents: number;
  orders: number;
  units: number;
  aovCents: number;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly supabase: SupabaseService) {}

  async overview(days: number) {
    const now = Date.now();
    const since = new Date(now - days * DAY);
    const prevSince = new Date(now - 2 * days * DAY);

    const [{ data: orderData }, { data: custData }, { data: quoteData }] =
      await Promise.all([
        this.supabase.client
          .from('orders')
          .select(ANALYTICS_SELECT)
          .gte('created_at', prevSince.toISOString())
          .returns<AnalyticsOrderRow[]>(),
        this.supabase.client
          .from('profiles')
          .select('created_at')
          .eq('role', 'customer')
          .gte('created_at', prevSince.toISOString())
          .returns<{ created_at: string }[]>(),
        this.supabase.client
          .from('quotes')
          .select('status, created_at')
          .gte('created_at', prevSince.toISOString())
          .returns<{ status: string; created_at: string }[]>(),
      ]);

    const orders = orderData ?? [];
    const sinceMs = since.getTime();
    const curOrders = orders.filter((o) => new Date(o.created_at).getTime() >= sinceMs);
    const prevOrders = orders.filter((o) => new Date(o.created_at).getTime() < sinceMs);

    const cur = this.totals(curOrders);
    const prev = this.totals(prevOrders);

    // ── Daily series (zero-filled, length = days) ────────────────────────────
    const labels: string[] = [];
    for (let i = 0; i < days; i++) {
      labels.push(new Date(sinceMs + i * DAY).toISOString().slice(0, 10));
    }
    const zeros = () => new Array(days).fill(0);
    const revenue = zeros();
    const ordersSpark = zeros();
    const units = zeros();
    const prevRevenue = zeros();

    const idx = (iso: string, start: number) =>
      Math.min(days - 1, Math.max(0, Math.floor((new Date(iso).getTime() - start) / DAY)));

    for (const o of curOrders) {
      const i = idx(o.created_at, sinceMs);
      revenue[i] += centsToEuros(o.total_cents);
      ordersSpark[i] += 1;
      units[i] += (o.items ?? []).reduce((n, it) => n + it.quantity, 0);
    }
    for (const o of prevOrders) {
      const i = idx(o.created_at, prevSince.getTime());
      prevRevenue[i] += centsToEuros(o.total_cents);
    }
    const aovSpark = revenue.map((r, i) => (ordersSpark[i] ? Math.round(r / ordersSpark[i]) : 0));

    // ── New customers (current vs previous + daily spark) ────────────────────
    const custs = custData ?? [];
    const newCustSpark = zeros();
    let newCur = 0;
    let newPrev = 0;
    for (const c of custs) {
      const t = new Date(c.created_at).getTime();
      if (t >= sinceMs) {
        newCur += 1;
        newCustSpark[idx(c.created_at, sinceMs)] += 1;
      } else {
        newPrev += 1;
      }
    }

    // ── Quotes funnel + conversion (current vs previous) ─────────────────────
    const quotes = quoteData ?? [];
    const curQuotes = quotes.filter((q) => new Date(q.created_at).getTime() >= sinceMs);
    const prevQuotes = quotes.filter((q) => new Date(q.created_at).getTime() < sinceMs);
    const conv = (qs: { status: string }[]) =>
      qs.length ? Math.round((qs.filter((q) => q.status === 'devis_accepte').length / qs.length) * 100) : 0;
    const funnel = {
      requested: curQuotes.length,
      sent: curQuotes.filter((q) => q.status !== 'en_attente_devis').length,
      accepted: curQuotes.filter((q) => q.status === 'devis_accepte').length,
      rejected: curQuotes.filter((q) => q.status === 'devis_rejete').length,
    };
    const convSpark = zeros();
    for (const q of curQuotes) {
      if (q.status === 'devis_accepte') convSpark[idx(q.created_at, sinceMs)] += 1;
    }

    // ── Breakdowns over current period ───────────────────────────────────────
    const byProduct = new Map<string, { name: string; image: string | null; units: number; revenueCents: number }>();
    const byCategory = new Map<string, { revenueCents: number; units: number }>();
    const byTerritory = new Map<string, { revenueCents: number; orders: number }>();
    const byStatus = new Map<OrderStatus, number>();
    const byCustomer = new Map<string, { name: string; spentCents: number; orders: number }>();
    const weekdayCents = new Array(7).fill(0); // 0=Mon .. 6=Sun

    for (const o of curOrders) {
      byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);

      const terr = byTerritory.get(o.territory) ?? { revenueCents: 0, orders: 0 };
      terr.revenueCents += o.total_cents;
      terr.orders += 1;
      byTerritory.set(o.territory, terr);

      const name = o.profile?.full_name || 'Client';
      const cust = byCustomer.get(o.profile_id) ?? { name, spentCents: 0, orders: 0 };
      cust.spentCents += o.total_cents;
      cust.orders += 1;
      byCustomer.set(o.profile_id, cust);

      const wd = (new Date(o.created_at).getUTCDay() + 6) % 7; // Mon=0
      weekdayCents[wd] += o.total_cents;

      for (const it of o.items ?? []) {
        const line = it.unit_price_cents * it.quantity;
        const key = it.product_id ?? it.product_name;
        const p = byProduct.get(key) ?? { name: it.product_name, image: it.product_image, units: 0, revenueCents: 0 };
        p.units += it.quantity;
        p.revenueCents += line;
        byProduct.set(key, p);

        const cat = it.product?.category?.name ?? 'Autres';
        const c = byCategory.get(cat) ?? { revenueCents: 0, units: 0 };
        c.revenueCents += line;
        c.units += it.quantity;
        byCategory.set(cat, c);
      }
    }

    const catTotal = [...byCategory.values()].reduce((n, c) => n + c.revenueCents, 0) || 1;
    const terrTotal = [...byTerritory.values()].reduce((n, t) => n + t.revenueCents, 0) || 1;
    const prodTotal = [...byProduct.values()].reduce((n, p) => n + p.revenueCents, 0) || 1;

    // Repeat customers = distinct customers with >= 2 orders this period.
    const distinctCustomers = byCustomer.size;
    const repeatCustomers = [...byCustomer.values()].filter((c) => c.orders >= 2).length;

    return {
      rangeDays: days,
      kpis: {
        revenue: { value: cur.revenueCents / 100, previous: prev.revenueCents / 100, spark: revenue },
        orders: { value: cur.orders, previous: prev.orders, spark: ordersSpark },
        avgOrderValue: { value: cur.aovCents / 100, previous: prev.aovCents / 100, spark: aovSpark },
        unitsSold: { value: cur.units, previous: prev.units, spark: units },
        newCustomers: { value: newCur, previous: newPrev, spark: newCustSpark },
        conversionRate: { value: conv(curQuotes), previous: conv(prevQuotes), spark: convSpark },
      },
      trend: { labels, revenue, orders: ordersSpark, units, prevRevenue },
      categoryMix: [...byCategory.entries()]
        .map(([category, v]) => ({
          category,
          revenue: centsToEuros(v.revenueCents),
          units: v.units,
          pct: Math.round((v.revenueCents / catTotal) * 100),
        }))
        .sort((a, b) => b.revenue - a.revenue),
      territory: [...byTerritory.entries()]
        .map(([territory, v]) => ({
          territory,
          revenue: centsToEuros(v.revenueCents),
          orders: v.orders,
          pct: Math.round((v.revenueCents / terrTotal) * 100),
        }))
        .sort((a, b) => b.revenue - a.revenue),
      ordersByStatus: [...byStatus.entries()].map(([status, count]) => ({
        status,
        label: orderStatusLabel(status),
        count,
      })),
      quoteFunnel: funnel,
      weekday: weekdayCents.map((c) => centsToEuros(c)),
      topProducts: [...byProduct.values()]
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, 10)
        .map((p) => ({
          name: p.name,
          image: p.image,
          units: p.units,
          revenue: centsToEuros(p.revenueCents),
          pct: Math.round((p.revenueCents / prodTotal) * 100),
        })),
      topCustomers: [...byCustomer.values()]
        .sort((a, b) => b.spentCents - a.spentCents)
        .slice(0, 8)
        .map((c) => ({ name: c.name, totalSpent: centsToEuros(c.spentCents), orders: c.orders })),
      customers: { distinct: distinctCustomers, repeat: repeatCustomers },
    };
  }

  private totals(rows: AnalyticsOrderRow[]): Totals {
    let revenueCents = 0;
    let units = 0;
    for (const o of rows) {
      revenueCents += o.total_cents;
      units += (o.items ?? []).reduce((n, it) => n + it.quantity, 0);
    }
    return {
      revenueCents,
      orders: rows.length,
      units,
      aovCents: rows.length ? Math.round(revenueCents / rows.length) : 0,
    };
  }
}
