import {
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';

/**
 * Stripe integration is deferred. These endpoints exist so the mobile checkout
 * flow has a stable contract; they return 501 until Stripe is wired up.
 */
@Controller('payments')
export class PaymentsController {
  @Post('create-intent')
  createIntent(): never {
    throw new HttpException(
      'Paiement en ligne bientôt disponible',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook() {
    // Acknowledge so Stripe doesn't retry once configured; no-op for now.
    return { received: true };
  }
}
