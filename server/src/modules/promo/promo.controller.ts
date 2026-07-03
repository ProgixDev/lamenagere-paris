import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { PromoService } from './promo.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';

export interface PromoPreviewDto {
  valid: boolean;
  message?: string;
  code?: string;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  discountCents?: number;
}

@Controller('promo-codes')
export class PromoController {
  constructor(private readonly promo: PromoService) {}

  /**
   * Checkout preview: validates a code against the cart and returns the
   * discount it would grant. Never 4xx's on a bad code — returns
   * { valid:false, message } so the app can show inline feedback. The
   * authoritative discount is recomputed server-side at order creation.
   */
  @Post('validate')
  async validate(
    @CurrentUser() user: AuthUser,
    @Body() dto: ValidatePromoDto,
  ): Promise<PromoPreviewDto> {
    try {
      const { promo, discountCents } = await this.promo.validateForCart(
        user.id,
        dto.code,
        dto.items.map((i) => ({
          productId: i.productId ?? null,
          lineTotalCents: i.lineTotalCents,
        })),
      );
      return {
        valid: true,
        code: promo.code,
        discountType: promo.discount_type,
        discountValue: promo.discount_value,
        discountCents,
      };
    } catch (e) {
      if (e instanceof BadRequestException) {
        const res = e.getResponse() as { message?: string | string[] };
        const message = Array.isArray(res?.message)
          ? res.message[0]
          : res?.message ?? 'Code promo invalide';
        return { valid: false, message };
      }
      throw e;
    }
  }
}
