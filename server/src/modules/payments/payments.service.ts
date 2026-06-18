import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
// The CJS types entry only re-exports the constructor; the rich resource types
// (Event, PaymentIntent, …) live in the core declaration namespace.
import type { Stripe as StripeNs } from 'stripe/cjs/stripe.core.js';
import { SupabaseService } from '../../common/supabase/supabase.service';

interface OrderPaymentRow {
  id: string;
  total_cents: number;
  payment_status: string;
  stripe_payment_intent_id: string | null;
}

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe!: StripeNs;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  onModuleInit() {
    this.stripe = new Stripe(
      this.config.getOrThrow<string>('STRIPE_SECRET_KEY'),
    );
  }

  /**
   * Creates (or reuses) a Stripe PaymentIntent for an order the user owns and
   * returns its client secret for the mobile/web payment sheet. Idempotent:
   * repeated calls for the same order reuse the stored PaymentIntent.
   */
  async createIntent(
    userId: string,
    orderId: string,
  ): Promise<{ clientSecret: string | null }> {
    const { data: order } = await this.supabase.client
      .from('orders')
      .select('id, total_cents, payment_status, stripe_payment_intent_id')
      .eq('id', orderId)
      .eq('profile_id', userId)
      .maybeSingle<OrderPaymentRow>();

    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.payment_status === 'paid') {
      throw new BadRequestException('Cette commande est déjà payée');
    }

    // Reuse an existing intent so retries don't create duplicate charges.
    if (order.stripe_payment_intent_id) {
      const existing = await this.stripe.paymentIntents.retrieve(
        order.stripe_payment_intent_id,
      );
      return { clientSecret: existing.client_secret };
    }

    const intent = await this.stripe.paymentIntents.create({
      amount: order.total_cents,
      currency: 'eur',
      metadata: { orderId: order.id },
      automatic_payment_methods: { enabled: true },
    });

    await this.supabase.client
      .from('orders')
      .update({ stripe_payment_intent_id: intent.id })
      .eq('id', order.id);

    return { clientSecret: intent.client_secret };
  }

  /**
   * Server-side reconciliation right after the client's Payment Sheet reports
   * success. We never trust the client: the PaymentIntent is re-fetched from
   * Stripe and the order is only marked paid when Stripe itself says
   * `succeeded`. Idempotent and safe to call alongside the webhook backstop.
   */
  async confirmPayment(
    userId: string,
    orderId: string,
  ): Promise<{ status: 'paid' | 'pending' | 'failed' }> {
    const { data: order } = await this.supabase.client
      .from('orders')
      .select('id, total_cents, payment_status, stripe_payment_intent_id')
      .eq('id', orderId)
      .eq('profile_id', userId)
      .maybeSingle<OrderPaymentRow>();

    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.payment_status === 'paid') return { status: 'paid' };
    if (!order.stripe_payment_intent_id) {
      throw new BadRequestException('Aucun paiement à confirmer');
    }

    const intent = await this.stripe.paymentIntents.retrieve(
      order.stripe_payment_intent_id,
    );

    if (intent.status === 'succeeded') {
      await this.supabase.client
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', order.id);
      return { status: 'paid' };
    }

    // Anything else (processing, requires_action, canceled…) leaves the order
    // pending; the webhook will reconcile the final state.
    return { status: 'pending' };
  }

  /**
   * Verifies the Stripe webhook signature and reconciles order payment status.
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true }> {
    let event: StripeNs.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid signature';
      throw new BadRequestException(`Webhook signature error: ${message}`);
    }

    if (
      event.type === 'payment_intent.succeeded' ||
      event.type === 'payment_intent.payment_failed'
    ) {
      const intent = event.data.object;
      const status =
        event.type === 'payment_intent.succeeded' ? 'paid' : 'failed';
      await this.markOrderPayment(intent, status);
    }

    return { received: true };
  }

  private async markOrderPayment(
    intent: StripeNs.PaymentIntent,
    status: 'paid' | 'failed',
  ): Promise<void> {
    const orderId = intent.metadata?.orderId;
    const query = this.supabase.client
      .from('orders')
      .update({ payment_status: status });

    const { error } = orderId
      ? await query.eq('id', orderId)
      : await query.eq('stripe_payment_intent_id', intent.id);

    if (error) {
      this.logger.error(
        `Failed to set payment_status=${status} for intent ${intent.id}: ${error.message}`,
      );
    }
  }
}
