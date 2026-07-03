import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

export interface PromoCodeRow {
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
}

/** One cart line reduced to what the discount math needs. */
export interface PromoLineItem {
  productId: string | null;
  lineTotalCents: number;
}

export interface PromoResult {
  promo: PromoCodeRow;
  /** Discount applied to the (eligible) subtotal, in cents. Always ≥ 0. */
  discountCents: number;
}

@Injectable()
export class PromoService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Validates a code against a cart and returns the discount it grants.
   * Throws BadRequestException with a customer-facing French message when the
   * code is unknown, inactive, out of its date window, exhausted (globally or
   * for this customer), below the minimum order, or not applicable to the cart.
   * Does NOT record a redemption — call recordRedemption() once the order is
   * committed.
   */
  async validateForCart(
    userId: string,
    rawCode: string,
    lineItems: PromoLineItem[],
  ): Promise<PromoResult> {
    const code = rawCode.trim().toUpperCase();
    if (!code) throw new BadRequestException('Code promo requis');

    const { data: promo } = await this.supabase.client
      .from('promo_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle<PromoCodeRow>();

    if (!promo || !promo.is_active) {
      throw new BadRequestException('Code promo invalide');
    }

    const now = Date.now();
    if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
      throw new BadRequestException("Ce code promo n'est pas encore actif");
    }
    if (promo.expires_at && new Date(promo.expires_at).getTime() < now) {
      throw new BadRequestException('Ce code promo a expiré');
    }

    if (
      promo.max_redemptions != null &&
      promo.times_redeemed >= promo.max_redemptions
    ) {
      throw new BadRequestException("Ce code promo n'est plus disponible");
    }

    if (promo.per_customer_limit != null) {
      const { count } = await this.supabase.client
        .from('promo_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('promo_code_id', promo.id)
        .eq('profile_id', userId);
      if ((count ?? 0) >= promo.per_customer_limit) {
        throw new BadRequestException('Vous avez déjà utilisé ce code promo');
      }
    }

    const subtotal = lineItems.reduce((s, l) => s + Math.max(0, l.lineTotalCents), 0);
    if (promo.min_order_cents != null && subtotal < promo.min_order_cents) {
      const min = (promo.min_order_cents / 100).toFixed(0);
      throw new BadRequestException(
        `Ce code requiert une commande d'au moins ${min} €`,
      );
    }

    // Product-scoped codes only discount that product's line(s); global codes
    // discount the whole subtotal.
    const eligible = promo.product_id
      ? lineItems
          .filter((l) => l.productId === promo.product_id)
          .reduce((s, l) => s + Math.max(0, l.lineTotalCents), 0)
      : subtotal;

    if (eligible <= 0) {
      throw new BadRequestException(
        "Ce code ne s'applique à aucun article de votre panier",
      );
    }

    const discountCents = this.computeDiscount(promo, eligible);
    if (discountCents <= 0) {
      throw new BadRequestException("Ce code n'accorde aucune réduction ici");
    }

    return { promo, discountCents };
  }

  private computeDiscount(promo: PromoCodeRow, eligibleCents: number): number {
    const raw =
      promo.discount_type === 'percent'
        ? Math.round((eligibleCents * promo.discount_value) / 100)
        : promo.discount_value;
    return Math.max(0, Math.min(raw, eligibleCents));
  }

  /**
   * Logs a redemption and bumps the global counter. Best-effort: a failure here
   * must not roll back an already-paid order, so callers should not await-throw.
   */
  async recordRedemption(
    promo: PromoCodeRow,
    userId: string,
    orderId: string,
    discountCents: number,
  ): Promise<void> {
    await this.supabase.client.from('promo_redemptions').insert({
      promo_code_id: promo.id,
      profile_id: userId,
      order_id: orderId,
      discount_cents: discountCents,
    });
    await this.supabase.client
      .from('promo_codes')
      .update({ times_redeemed: promo.times_redeemed + 1 })
      .eq('id', promo.id);
  }
}
