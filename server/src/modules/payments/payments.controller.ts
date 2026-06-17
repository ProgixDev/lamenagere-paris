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
import { PaymentsService } from './payments.service';

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
