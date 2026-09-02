import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { CreateIntentDto } from './dto/create-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { ConfirmDraftDto } from './dto/confirm-draft.dto';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { OrderDto } from '../orders/orders.serializer';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('create-intent')
  createIntent(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateIntentDto,
  ): Promise<{ clientSecret: string | null }> {
    return this.payments.createIntent(user.id, dto.orderId);
  }

  @Post('confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmPaymentDto,
  ): Promise<{ status: 'paid' | 'pending' | 'failed' }> {
    return this.payments.confirmPayment(user.id, dto.orderId);
  }

  /**
   * Prices the cart and creates a Stripe PaymentIntent for it, WITHOUT
   * creating an `orders` row — the cart is staged as an `order_drafts` row
   * instead. This is what keeps an abandoned checkout from ever reaching the
   * admin dashboard: nothing is written to `orders` until `confirm-draft` (or
   * the webhook backstop) finalizes it after Stripe confirms payment.
   */
  @Post('create-intent-draft')
  createIntentDraft(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
  ): Promise<{ clientSecret: string | null; draftId: string }> {
    return this.payments.createIntentDraft(
      user.id,
      dto,
      user.accountType === 'professionnel',
    );
  }

  @Post('confirm-draft')
  confirmDraft(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmDraftDto,
  ): Promise<{ status: 'paid'; order: OrderDto } | { status: 'pending' }> {
    return this.payments.confirmDraft(user.id, dto.draftId);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<FastifyRequest>) {
    const signature = req.headers['stripe-signature'];
    if (!req.rawBody || typeof signature !== 'string') {
      throw new BadRequestException('Missing Stripe signature or body');
    }
    return this.payments.handleWebhook(req.rawBody, signature);
  }
}
