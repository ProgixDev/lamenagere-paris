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

interface AddressRowFull {
  id: string;
  first_name: string;
  last_name: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  territory: ShippingZone;
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

@Injectable()
export class OrdersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly pricing: PricingService,
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

    // 1. Address (must belong to the user) -> snapshot.
    const { data: address } = await this.supabase.client
      .from('addresses')
      .select('id, first_name, last_name, street, postal_code, city, country, territory')
      .eq('id', dto.shippingAddressId)
      .eq('profile_id', userId)
      .maybeSingle<AddressRowFull>();
    if (!address) throw new NotFoundException('Adresse de livraison introuvable');

    // 2. Resolve each line price server-side.
    const productIds = dto.items.map((i) => i.productId);
    const { data: products } = await this.supabase.client
      .from('products')
      .select(
        'id, name, price_mode, base_price_cents, width_coef_cents, height_coef_cents, price_per_sqm_cents, ref_width, ref_height, min_width, min_height, max_width, max_height, opening_types, delivery_metropole, delivery_outremer, config_blocks, media:product_media(url,type,is_primary), category:categories(config_blocks)',
      )
      .in('id', productIds)
      .returns<ProductForOrder[]>();
    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    let subtotal = 0;
    const itemRows = dto.items.map((item) => {
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
      .eq('zone', dto.territory)
      .maybeSingle<{ delay: string; fee_cents: number }>();
    const shippingCost = zoneFee?.fee_cents ?? 0;
    const total = subtotal + shippingCost;

    // 4. Atomic order number.
    const year = new Date().getFullYear();
    const { data: seq } = await this.supabase.client.rpc('next_counter', {
      p_scope: `order:${year}`,
    });
    const orderNumber = `LMP-${year}-${String(seq ?? 1).padStart(5, '0')}`;

    const estimatedDelivery = isOverseas(dto.territory)
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
        territory: dto.territory,
        shipping_method: dto.shippingMethod,
        estimated_delivery: estimatedDelivery,
        ship_first_name: address.first_name,
        ship_last_name: address.last_name,
        ship_street: address.street,
        ship_postal_code: address.postal_code,
        ship_city: address.city,
        ship_country: address.country,
        ship_territory: address.territory,
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

    // 7. Profile aggregates.
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
