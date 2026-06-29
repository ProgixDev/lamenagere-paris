import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { PricingService } from '../../common/pricing/pricing.service';
import {
  isOverseas,
  orderStatusLabel,
  ShippingZone,
  territoryFromPostalCode,
} from '../../common/serialization/status-labels';
import {
  ORDER_SELECT,
  OrderDto,
  OrderRow,
  toOrderDto,
  toTracking,
  TrackingInfo,
} from './orders.serializer';
import { CreateOrderDto } from './dto/create-order.dto';
import type { ConfigBlock } from '../catalog/catalog.serializer';
import { TicketsService } from '../tickets/tickets.service';

interface AddressRowFull {
  id: string;
  first_name: string;
  last_name: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  territory: ShippingZone;
  phone: string | null;
}

interface ProductForOrder {
  id: string;
  name: string;
  price_mode: 'fixed' | 'calculated' | 'per_sqm' | 'quote';
  base_price_cents: number | null;
  width_coef_cents: number | null;
  height_coef_cents: number | null;
  price_per_sqm_cents: number | null;
  ref_width: number | null;
  ref_height: number | null;
  min_width: number | null;
  min_height: number | null;
  max_width: number | null;
  max_height: number | null;
  opening_types: { type: string; surcharge_cents: number }[] | null;
  delivery_metropole: string;
  delivery_outremer: string;
  media: { url: string; type: string; is_primary: boolean }[];
  config_blocks: ConfigBlock[] | null;
  category: { config_blocks: ConfigBlock[] | null } | null;
}

interface QuoteForOrder {
  id: string;
  product_id: string | null;
  product_name: string | null;
  product_image: string | null;
  quoted_price_cents: number | null;
  status: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly pricing: PricingService,
    private readonly tickets: TicketsService,
  ) {}

  async list(userId: string): Promise<OrderDto[]> {
    const { data } = await this.supabase.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .returns<OrderRow[]>();
    return (data ?? []).map(toOrderDto);
  }

  async findOne(userId: string, id: string): Promise<OrderDto> {
    const row = await this.loadOwned(userId, id);
    return toOrderDto(row);
  }

  async tracking(userId: string, id: string): Promise<TrackingInfo> {
    const row = await this.loadOwned(userId, id);
    return toTracking(row);
  }

  /**
   * Customer files a refund request on a paid order. Only allowed once per
   * order while no request/decision is in flight; an admin later accepts
   * (issuing the Stripe refund) or rejects it.
   */
  async requestRefund(
    userId: string,
    id: string,
    reason?: string,
  ): Promise<OrderDto> {
    const row = await this.loadOwned(userId, id);
    if (row.payment_status !== 'paid') {
      throw new BadRequestException(
        'Seules les commandes payées peuvent faire l’objet d’un remboursement',
      );
    }
    if (row.refund_status && row.refund_status !== 'none') {
      throw new BadRequestException(
        'Une demande de remboursement est déjà en cours ou a déjà été traitée',
      );
    }
    await this.supabase.client
      .from('orders')
      .update({
        refund_status: 'requested',
        refund_reason: reason?.trim() || null,
        refund_requested_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    await this.supabase.client.from('order_notes').insert({
      order_id: row.id,
      author_id: userId,
      body: `Demande de remboursement du client: ${reason?.trim() || '(aucun motif précisé)'}`,
    });

    // Also surface the refund request in the SAV (tickets) — best-effort.
    try {
      await this.tickets.create(userId, {
        subject: `Demande de remboursement — ${row.order_number}`,
        category: 'paiement',
        description:
          reason?.trim() ||
          'Demande de remboursement (aucun motif précisé).',
        orderId: row.id,
      });
    } catch {
      // a failed SAV ticket must not block the refund request
    }

    return this.findOne(userId, row.id);
  }

  async cancel(userId: string, id: string): Promise<void> {
    const row = await this.loadOwned(userId, id);
    if (row.status === 'expediee' || row.status === 'livree') {
      throw new BadRequestException(
        'Une commande expédiée ne peut pas être annulée',
      );
    }
    await this.supabase.client.from('orders').delete().eq('id', id);
  }

  async create(
    userId: string,
    dto: CreateOrderDto,
    isB2b: boolean,
  ): Promise<OrderDto> {
    if (dto.items.length === 0) {
      throw new BadRequestException('Le panier est vide');
    }

    // 1. Resolve the shipping snapshot from either the inline delivery form or
    //    a saved address that must belong to the user.
    let ship: {
      first_name: string;
      last_name: string;
      street: string;
      postal_code: string;
      city: string;
      country: string;
      phone: string | null;
      territory: ShippingZone;
    };
    if (dto.shippingAddress) {
      const a = dto.shippingAddress;
      ship = {
        first_name: a.firstName,
        last_name: a.lastName,
        street: a.street,
        postal_code: a.postalCode,
        city: a.city,
        country: a.country ?? 'France',
        phone: a.phone ?? null,
        territory: a.territory ?? territoryFromPostalCode(a.postalCode),
      };
    } else if (dto.shippingAddressId) {
      const { data: address } = await this.supabase.client
        .from('addresses')
        .select('id, first_name, last_name, street, postal_code, city, country, territory, phone')
        .eq('id', dto.shippingAddressId)
        .eq('profile_id', userId)
        .maybeSingle<AddressRowFull>();
      if (!address) throw new NotFoundException('Adresse de livraison introuvable');
      ship = {
        first_name: address.first_name,
        last_name: address.last_name,
        street: address.street,
        postal_code: address.postal_code,
        city: address.city,
        country: address.country,
        phone: address.phone ?? null,
        territory: dto.territory ?? address.territory,
      };
    } else {
      throw new BadRequestException('Adresse de livraison requise');
    }
    const territory = ship.territory;

    // 2. Resolve each line price server-side. Devis lines use the admin-quoted
    //    price; normal lines are priced from the product + config blocks.
    const productIds = dto.items.filter((i) => !i.quoteId).map((i) => i.productId);
    const { data: products } = await this.supabase.client
      .from('products')
      .select(
        'id, name, price_mode, base_price_cents, width_coef_cents, height_coef_cents, price_per_sqm_cents, ref_width, ref_height, min_width, min_height, max_width, max_height, opening_types, delivery_metropole, delivery_outremer, config_blocks, media:product_media(url,type,is_primary), category:categories(config_blocks)',
      )
      .in('id', productIds.length ? productIds : ['00000000-0000-0000-0000-000000000000'])
      .returns<ProductForOrder[]>();
    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    const quoteIds = dto.items
      .map((i) => i.quoteId)
      .filter((q): q is string => !!q);
    const quotesById = new Map<string, QuoteForOrder>();
    if (quoteIds.length) {
      const { data: qs } = await this.supabase.client
        .from('quotes')
        .select('id, product_id, product_name, product_image, quoted_price_cents, status')
        .in('id', quoteIds)
        .eq('profile_id', userId)
        .returns<QuoteForOrder[]>();
      for (const q of qs ?? []) quotesById.set(q.id, q);
    }

    let subtotal = 0;
    const itemRows = dto.items.map((item) => {
      // Devis line → fixed admin-quoted price.
      if (item.quoteId) {
        const q = quotesById.get(item.quoteId);
        if (!q) throw new BadRequestException('Devis introuvable');
        if (
          q.quoted_price_cents == null ||
          (q.status !== 'devis_envoye' && q.status !== 'devis_accepte')
        ) {
          throw new BadRequestException('Ce devis ne peut pas être commandé');
        }
        subtotal += q.quoted_price_cents * item.quantity;
        return {
          product_id: q.product_id,
          product_name: q.product_name ?? 'Devis',
          product_image: q.product_image ?? null,
          quantity: item.quantity,
          unit_price_cents: q.quoted_price_cents,
          custom_width: null,
          custom_height: null,
          opening_type: null,
          configuration: [],
        };
      }

      const product = byId.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Produit introuvable: ${item.productId}`);
      }
      const baseUnit = this.pricing.resolveUnitPriceCents(
        product,
        item.customDimensions,
        item.openingType,
      );
      // Re-price config-block add-ons (colors/accessories/openings) server-side
      // and snapshot the selection for the order line.
      const effectiveBlocks = product.config_blocks?.length
        ? product.config_blocks
        : product.category?.config_blocks ?? [];
      const { surchargeCents, snapshot } = this.pricing.priceConfiguration(
        effectiveBlocks,
        item.configuration,
      );
      const unit = baseUnit + surchargeCents;
      subtotal += unit * item.quantity;
      const primary =
        product.media?.find((m) => m.is_primary && m.type === 'image') ??
        product.media?.find((m) => m.type === 'image');
      return {
        product_id: product.id,
        product_name: product.name,
        product_image: primary?.url ?? null,
        quantity: item.quantity,
        unit_price_cents: unit,
        custom_width: item.customDimensions?.width ?? null,
        custom_height: item.customDimensions?.height ?? null,
        opening_type: item.openingType ?? null,
        configuration: snapshot,
      };
    });

    // 3. Shipping fee from zone table.
    const { data: zoneFee } = await this.supabase.client
      .from('shipping_zone_fees')
      .select('delay, fee_cents')
      .eq('zone', territory)
      .maybeSingle<{ delay: string; fee_cents: number }>();
    const shippingCost = zoneFee?.fee_cents ?? 0;
    const total = subtotal + shippingCost;

    // 4. Atomic order number.
    const year = new Date().getFullYear();
    const { data: seq } = await this.supabase.client.rpc('next_counter', {
      p_scope: `order:${year}`,
    });
    const orderNumber = `LMP-${year}-${String(seq ?? 1).padStart(5, '0')}`;

    const estimatedDelivery = isOverseas(territory)
      ? zoneFee?.delay ?? '8-12 semaines'
      : zoneFee?.delay ?? '2-3 semaines';

    // 5. Insert order.
    const { data: order, error } = await this.supabase.client
      .from('orders')
      .insert({
        order_number: orderNumber,
        profile_id: userId,
        status: 'commande_confirmee',
        subtotal_cents: subtotal,
        shipping_cost_cents: shippingCost,
        total_cents: total,
        territory,
        shipping_method: dto.shippingMethod,
        estimated_delivery: estimatedDelivery,
        ship_first_name: ship.first_name,
        ship_last_name: ship.last_name,
        ship_street: ship.street,
        ship_postal_code: ship.postal_code,
        ship_city: ship.city,
        ship_country: ship.country,
        ship_territory: ship.territory,
        ship_phone: ship.phone,
        is_b2b: isB2b,
        customer_note: dto.customerNote?.trim() || null,
        customer_attachments: dto.customerAttachments ?? [],
      })
      .select('id')
      .single<{ id: string }>();
    if (error || !order) {
      throw new BadRequestException(
        error?.message ?? 'Création de la commande impossible',
      );
    }

    // 6. Items + initial timeline.
    await this.supabase.client
      .from('order_items')
      .insert(itemRows.map((r) => ({ ...r, order_id: order.id })));
    await this.supabase.client.from('order_timeline').insert({
      order_id: order.id,
      status: 'commande_confirmee',
      label: orderStatusLabel('commande_confirmee'),
      completed: true,
      occurred_at: new Date().toISOString(),
    });

    // 7. Mark any consumed devis as accepted so they can't be re-ordered.
    if (quoteIds.length) {
      await this.supabase.client
        .from('quotes')
        .update({ status: 'devis_accepte', decided_at: new Date().toISOString() })
        .in('id', quoteIds)
        .eq('profile_id', userId);
    }

    // 8. Profile aggregates.
    await this.bumpProfileAggregates(userId, total);

    return this.findOne(userId, order.id);
  }

  private async loadOwned(userId: string, id: string): Promise<OrderRow> {
    const { data } = await this.supabase.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', id)
      .eq('profile_id', userId)
      .maybeSingle<OrderRow>();
    if (!data) throw new NotFoundException('Commande introuvable');
    return data;
  }

  private async bumpProfileAggregates(
    userId: string,
    totalCents: number,
  ): Promise<void> {
    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('orders_count, total_spent_cents')
      .eq('id', userId)
      .maybeSingle<{ orders_count: number; total_spent_cents: number }>();
    await this.supabase.client
      .from('profiles')
      .update({
        orders_count: (profile?.orders_count ?? 0) + 1,
        total_spent_cents: (profile?.total_spent_cents ?? 0) + totalCents,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }
}
