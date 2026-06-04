import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { formatEURFromCents } from '../../common/serialization/money.util';
import { initials } from '../../common/serialization/initials.util';
import { AccountType, ShippingZone } from '../../common/serialization/status-labels';
import { toAddressDto, AddressRow } from '../auth/auth.serializer';

interface CustomerProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  account_type: AccountType;
  company: string | null;
  siret: string | null;
  orders_count: number;
  total_spent_cents: number;
  last_activity_at: string | null;
  created_at: string;
}

export interface AdminCustomerDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: AccountType;
  company?: string;
  siret?: string;
  territory: ShippingZone;
  orders: number;
  totalSpent: string;
  lastActivity: string;
  createdAt: string;
  avatarInitials: string;
}

const PROFILE_COLS =
  'id, email, first_name, last_name, phone, account_type, company, siret, orders_count, total_spent_cents, last_activity_at, created_at';

@Injectable()
export class AdminCustomersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(opts: {
    type?: AccountType;
    q?: string;
  }): Promise<AdminCustomerDto[]> {
    let query = this.supabase.client
      .from('profiles')
      .select(PROFILE_COLS)
      .neq('role', 'super_admin');
    if (opts.type) query = query.eq('account_type', opts.type);
    if (opts.q && opts.q.trim()) {
      const term = `%${opts.q.trim()}%`;
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`,
      );
    }
    const { data } = await query
      .order('created_at', { ascending: false })
      .returns<CustomerProfileRow[]>();

    const rows = data ?? [];
    const territories = await this.territories(rows.map((r) => r.id));
    return rows.map((r) => this.toDto(r, territories.get(r.id)));
  }

  async detail(id: string) {
    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', id)
      .maybeSingle<CustomerProfileRow>();
    if (!profile) throw new NotFoundException('Client introuvable');

    const [{ data: addresses }, { data: orders }, { data: quotes }] =
      await Promise.all([
        this.supabase.client
          .from('addresses')
          .select(
            'id, first_name, last_name, street, postal_code, city, country, territory, is_default',
          )
          .eq('profile_id', id)
          .returns<AddressRow[]>(),
        this.supabase.client
          .from('orders')
          .select('order_number, total_cents, status, created_at')
          .eq('profile_id', id)
          .order('created_at', { ascending: false })
          .limit(5)
          .returns<
            {
              order_number: string;
              total_cents: number;
              status: string;
              created_at: string;
            }[]
          >(),
        this.supabase.client
          .from('quotes')
          .select('quote_number, status, quoted_price_cents, created_at')
          .eq('profile_id', id)
          .order('created_at', { ascending: false })
          .limit(5)
          .returns<
            {
              quote_number: string | null;
              status: string;
              quoted_price_cents: number | null;
              created_at: string;
            }[]
          >(),
      ]);

    const defaultTerritory =
      (addresses ?? []).find((a) => a.is_default)?.territory ??
      (addresses ?? [])[0]?.territory;

    return {
      customer: this.toDto(profile, defaultTerritory),
      addresses: (addresses ?? []).map(toAddressDto),
      orders: (orders ?? []).map((o) => ({
        id: o.order_number,
        total: formatEURFromCents(o.total_cents),
        status: o.status,
        createdAt: o.created_at,
      })),
      quotes: (quotes ?? []).map((q) => ({
        id: q.quote_number ?? '',
        status: q.status,
        quotedPrice:
          q.quoted_price_cents != null
            ? formatEURFromCents(q.quoted_price_cents)
            : undefined,
        createdAt: q.created_at,
      })),
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private async territories(
    ids: string[],
  ): Promise<Map<string, ShippingZone>> {
    const map = new Map<string, ShippingZone>();
    if (ids.length === 0) return map;
    const { data } = await this.supabase.client
      .from('addresses')
      .select('profile_id, territory, is_default')
      .in('profile_id', ids)
      .returns<
        { profile_id: string; territory: ShippingZone; is_default: boolean }[]
      >();
    for (const a of data ?? []) {
      if (a.is_default || !map.has(a.profile_id)) {
        map.set(a.profile_id, a.territory);
      }
    }
    return map;
  }

  private toDto(
    r: CustomerProfileRow,
    territory?: ShippingZone,
  ): AdminCustomerDto {
    return {
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone ?? '',
      type: r.account_type,
      company: r.company ?? undefined,
      siret: r.siret ?? undefined,
      territory: territory ?? 'metropole',
      orders: r.orders_count,
      totalSpent: formatEURFromCents(r.total_spent_cents),
      lastActivity: r.last_activity_at ?? r.created_at,
      createdAt: r.created_at,
      avatarInitials: initials(r.first_name, r.last_name),
    };
  }
}
