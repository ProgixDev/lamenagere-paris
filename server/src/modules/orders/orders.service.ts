import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { blockApplies, PricingService } from '../../common/pricing/pricing.service';
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
import type {
  ConfigBlock,
  ConfiguredLayout,
} from '../catalog/catalog.serializer';

/**
 * Id of the synthetic configuration entry that carries the product's own
 * colourway. Mirrors `PRODUCT_COLOR_BLOCK_ID` in the app.
 */
const PRODUCT_COLOR_BLOCK_ID = 'product-color';

/**
 * The chosen gamme is stored on the line as a bare key, which reads as "haute"
 * in the back office and would follow a later rename. Snapshotting its label
 * alongside the rest of the configuration keeps the order readable and true to
 * what was sold.
 */
const QUALITY_TIER_BLOCK_ID = 'quality-tier';

/**
 * Id of the synthetic entry carrying the 3D implantation. Mirrors
 * `LAYOUT_BLOCK_ID` in the app.
 */
const LAYOUT_BLOCK_ID = 'kitchen-layout';

/**
 * Re-shapes a client-sent implantation into something safe to store.
 *
 * The layout is the one part of a line the server cannot recompute — it is the
 * customer's own arrangement — so it is copied rather than derived. That makes
 * it the only client-controlled blob on an order, hence the hard caps: it never
 * touches the price, but it does land in the back office and in jsonb, and
 * neither should be at the mercy of what an app sends.
 */
export function sanitizeLayout(raw: unknown): ConfiguredLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const l = raw as Record<string, any>;

  const num = (v: unknown, max: number): number | null => {
    const n = typeof v === 'number' ? v : Number.NaN;
    return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 1000) / 1000 : null;
  };
  /**
   * The same clamp, for a coordinate that may sit either side of the origin.
   *
   * Run and island positions are measured from the middle of the kitchen, so
   * half of every legitimate value is negative — passing them through `num`
   * would silently null them and lose the arrangement the customer built.
   */
  const signed = (v: unknown, max: number): number | null => {
    const n = typeof v === 'number' ? v : Number.NaN;
    return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 1000) / 1000 : null;
  };
  const quarters = (v: unknown): number => ([0, 1, 2, 3] as unknown[]).includes(v) ? (v as number) : 0;
  const text = (v: unknown, max = 80): string =>
    typeof v === 'string' ? v.slice(0, max) : '';
  const cents = (v: unknown): number => {
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;
    return Math.min(Math.max(n, 0), 100_000_000);
  };

  const widthM = num(l.room?.widthM, 40);
  const depthM = num(l.room?.depthM, 40);
  const heightM = num(l.room?.heightM, 10);
  if (widthM == null || depthM == null || heightM == null) return null;

  const runs = (Array.isArray(l.runs) ? l.runs : []).slice(0, 4).map((r: any) => ({
    wall: text(r?.wall, 12),
    lengthM: num(r?.lengthM, 40) ?? 0,
    // Where the customer actually stood this run. Kept even when it is zero:
    // the plan cannot be drawn from lengths and wall names alone any more.
    x: signed(r?.x, 40) ?? 0,
    z: signed(r?.z, 40) ?? 0,
    rotationQuarters: quarters(r?.rotationQuarters),
    ...(r?.overlaps === true ? { overlaps: true } : {}),
    modules: (Array.isArray(r?.modules) ? r.modules : [])
      .slice(0, 60)
      .map((m: any) => ({
        moduleId: text(m?.moduleId, 64),
        label: text(m?.label),
        // Anything unrecognised falls back to a base unit rather than being
        // stored as free text a recap would then group under a bogus heading.
        slot: ['bas', 'haut', 'colonne'].includes(m?.slot) ? m.slot : 'bas',
        offsetM: num(m?.offsetM, 40) ?? 0,
        // Millimetres, and a cabinet wider than the room it sits in is a lie
        // the back office plan would then have to draw.
        widthMm: Math.round((num(m?.widthMm, 40_000) ?? 0) as number),
        depthMm: Math.round((num(m?.depthMm, 40_000) ?? 0) as number),
        // Only carried when the customer took this cabinet out of the row and
        // stood it somewhere of its own. Dropped as a pair: half a position is
        // no position, and defaulting the missing half to zero would put the
        // caisson in the middle of the room rather than admit it was lost.
        ...(signed(m?.x, 40) != null && signed(m?.z, 40) != null
          ? {
              x: signed(m?.x, 40) as number,
              z: signed(m?.z, 40) as number,
              rotationQuarters: quarters(m?.rotationQuarters),
            }
          : {}),
        priceCents: cents(m?.priceCents),
      }))
      .filter((m: { moduleId: string }) => m.moduleId.length > 0),
  }));
  if (!runs.length) return null;

  const ilotW = num(l.ilot?.widthM, 20);
  const ilotD = num(l.ilot?.depthM, 20);

  return {
    shape: text(l.shape, 4),
    room: { widthM, depthM, heightM },
    runs,
    ilot:
      ilotW != null && ilotD != null
        ? {
            widthM: ilotW,
            depthM: ilotD,
            topM: num(l.ilot?.topM, 3) ?? 0.9,
            rotationQuarters: [0, 1, 2, 3].includes(l.ilot?.rotationQuarters)
              ? l.ilot.rotationQuarters
              : 0,
            tight: l.ilot?.tight === true,
          }
        : undefined,
    rotationQuarters: [0, 1, 2, 3].includes(l.rotationQuarters) ? l.rotationQuarters : 0,
    worktopTopM: num(l.worktopTopM, 3) ?? 0.9,
    credence: l.credence !== false,
    modulesTotalCents: cents(l.modulesTotalCents),
  };
}
import { TicketsService } from '../tickets/tickets.service';
import { PromoService, PromoCodeRow } from '../promo/promo.service';

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
  area_formula: string | null;
  ref_width: number | null;
  ref_height: number | null;
  min_width: number | null;
  min_height: number | null;
  max_width: number | null;
  max_height: number | null;
  quality_tiers:
    | { key: string; label: string; price_per_sqm_cents: number }[]
    | null;
  delivery_metropole: string;
  delivery_outremer: string;
  media: { url: string; type: string; is_primary: boolean }[];
  colors: { key: string; name: string; hex: string | null; images: string[] | null }[] | null;
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
    private readonly promo: PromoService,
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
        'id, name, price_mode, base_price_cents, width_coef_cents, height_coef_cents, price_per_sqm_cents, area_formula, ref_width, ref_height, min_width, min_height, max_width, max_height, quality_tiers, delivery_metropole, delivery_outremer, config_blocks, colors, media:product_media(url,type,is_primary), category:categories(config_blocks)',
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
          custom_length: null,
          custom_left: null,
          custom_back: null,
          custom_right: null,
          opening_type: null,
          quality_tier: null,
          configuration: [],
        };
      }

      const product = byId.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Produit introuvable: ${item.productId}`);
      }
      // Blocks reserved for the other pricing mode are dropped before anything
      // is priced or snapshotted, so a stale client can't have one billed.
      const effectiveBlocks = (
        product.config_blocks?.length
          ? product.config_blocks
          : product.category?.config_blocks ?? []
      ).filter((b) => blockApplies(b, product.price_mode === 'per_sqm'));
      // Shape-driven products (a kitchen billed on its developed run) take
      // their dimensions from what the customer already entered in the config
      // blocks, so nothing is asked for twice and nothing is client-supplied.
      const dims =
        product.area_formula === 'by_shape'
          ? this.pricing.dimensionsFromSelection(
              effectiveBlocks,
              item.configuration,
            )
          : item.customDimensions;
      const baseUnit = this.pricing.resolveUnitPriceCents(
        product,
        dims,
        item.qualityTier,
      );
      // Re-price config-block add-ons (colors/accessories/openings) server-side
      // and snapshot the selection for the order line.
      const { surchargeCents, snapshot } = this.pricing.priceConfiguration(
        effectiveBlocks,
        item.configuration,
      );
      // The product's own colourway has no block behind it, so it survives
      // `priceConfiguration` only if re-attached here — validated against the
      // product's real variants, never trusting the label the client sent.
      const wanted = (item.configuration ?? []).find(
        (e) => e.blockId === PRODUCT_COLOR_BLOCK_ID,
      )?.colors?.[0]?.key;
      const variant = wanted
        ? product.colors?.find((c) => c.key === wanted)
        : undefined;
      if (variant) {
        snapshot.push({
          blockId: PRODUCT_COLOR_BLOCK_ID,
          type: 'colors',
          label: 'Coloris',
          colors: [
            {
              key: variant.key,
              label: variant.name,
              // The colourway's own photo, so the back office sees the finish
              // that was sold rather than an empty swatch.
              image: variant.images?.[0],
              hex: variant.hex ?? undefined,
            },
          ],
        });
      }
      const tier = item.qualityTier
        ? product.quality_tiers?.find((t) => t.key === item.qualityTier)
        : undefined;
      if (tier) {
        snapshot.push({
          blockId: QUALITY_TIER_BLOCK_ID,
          type: 'options',
          label: 'Gamme',
          options: [{ key: tier.key, label: tier.label }],
        });
      }
      // The implantation has no block behind it either, so like the colourway
      // it survives `priceConfiguration` only if re-attached here.
      const layout = sanitizeLayout(
        (item.configuration ?? []).find((e) => e.blockId === LAYOUT_BLOCK_ID)?.layout,
      );
      if (layout) {
        snapshot.push({
          blockId: LAYOUT_BLOCK_ID,
          type: 'layout',
          label: 'Implantation',
          layout,
        });
      }
      const unit = baseUnit + surchargeCents;
      subtotal += unit * item.quantity;
      // The line keeps the picture of the colourway the customer actually
      // chose; failing that the primary media, then any colour that has one.
      const primaryUrl =
        variant?.images?.[0] ??
        (
          product.media?.find((m) => m.is_primary && m.type === 'image') ??
          product.media?.find((m) => m.type === 'image')
        )?.url ??
        product.colors?.find((c) => c.images?.length)?.images?.[0];
      return {
        product_id: product.id,
        product_name: product.name,
        product_image: primaryUrl ?? null,
        quantity: item.quantity,
        unit_price_cents: unit,
        custom_width: dims?.width ?? null,
        custom_height: dims?.height ?? null,
        custom_length: dims?.length ?? null,
        custom_left: dims?.left ?? null,
        custom_back: dims?.back ?? null,
        custom_right: dims?.right ?? null,
        quality_tier: item.qualityTier ?? null,
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

    // Promo code (optional): re-validate against the server-priced lines and
    // apply the discount to the subtotal. Charge = subtotal - discount + ship.
    let promoRow: PromoCodeRow | null = null;
    let discountCents = 0;
    if (dto.promoCode?.trim()) {
      const lineItems = itemRows.map((r) => ({
        productId: r.product_id,
        lineTotalCents: r.unit_price_cents * r.quantity,
      }));
      const res = await this.promo.validateForCart(
        userId,
        dto.promoCode,
        lineItems,
      );
      promoRow = res.promo;
      discountCents = Math.min(res.discountCents, subtotal);
    }
    const total = Math.max(0, subtotal - discountCents) + shippingCost;

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
        discount_cents: discountCents,
        promo_code: promoRow?.code ?? null,
        promo_code_id: promoRow?.id ?? null,
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

    // 6b. Log the promo redemption (per-customer cap + global counter).
    //     Best-effort: the order is already committed, so a failure here must
    //     not fail the checkout.
    if (promoRow && discountCents > 0) {
      try {
        await this.promo.recordRedemption(
          promoRow,
          userId,
          order.id,
          discountCents,
        );
      } catch {
        // ignore — redemption logging must not block a placed order
      }
    }

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
