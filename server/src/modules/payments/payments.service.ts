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
import { ActivityService } from '../../common/activity/activity.service';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { OrderDto } from '../orders/orders.serializer';
import {
  advanceDispute,
  advanceSettlement,
  disputeStatusFromStripe,
  mergeRefundedTotal,
  paymentStatusForRefund,
  refundStatusFor,
  settlementFromStripe,
  type DisputeStatus,
  type PaymentStatus,
  type RefundSettlement,
  type RefundStatus,
} from './reconciliation';

interface OrderPaymentRow {
  id: string;
  total_cents: number;
  payment_status: string;
  stripe_payment_intent_id: string | null;
}

interface OrderRefundRow {
  id: string;
  total_cents: number;
  payment_status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  refund_amount_cents: number | null;
  refund_settlement: RefundSettlement | null;
  refund_status: RefundStatus;
}

/** Everything the webhook handlers need to decide an order's next money state. */
interface OrderMoneyRow {
  id: string;
  order_number: string;
  profile_id: string | null;
  total_cents: number;
  payment_status: PaymentStatus;
  refund_status: RefundStatus;
  refund_settlement: RefundSettlement;
  refunded_total_cents: number;
  dispute_status: DisputeStatus;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_refund_id: string | null;
}

const MONEY_COLUMNS =
  'id, order_number, profile_id, total_cents, payment_status, refund_status, ' +
  'refund_settlement, refunded_total_cents, dispute_status, ' +
  'stripe_payment_intent_id, stripe_charge_id, stripe_refund_id';

/** Postgres unique-violation, i.e. this webhook event was already claimed. */
const UNIQUE_VIOLATION = '23505';

/** Pulls an id out of a Stripe field that may be expanded into a full object. */
function idOf(
  ref: string | { id: string } | null | undefined,
): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

// True when Stripe reports the object doesn't exist under the current key
// (e.g. "No such payment_intent" after a key/account switch).
function isResourceMissing(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeInvalidRequestError &&
    err.code === 'resource_missing'
  );
}

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe!: StripeNs;
  /** Whether this tier is allowed to act on real-money events. See onModuleInit. */
  private expectsLiveMode = false;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly activity: ActivityService,
    private readonly orders: OrdersService,
  ) {}

  onModuleInit() {
    this.stripe = new Stripe(
      this.config.getOrThrow<string>('STRIPE_SECRET_KEY'),
    );
    this.expectsLiveMode = this.config.get<string>('APP_ENV') === 'production';

    // A production deploy with no webhook secret answers every delivery with a
    // 400. Nothing breaks visibly — checkout still reconciles through the
    // confirm endpoint — but refunds that bounce days later and disputes go
    // unrecorded, and the only trace is a failure count in a dashboard nobody
    // opens. Runs here rather than in main.ts because Vercel boots through
    // serverless.ts, which never calls it.
    if (this.expectsLiveMode && !this.config.get<string>('STRIPE_WEBHOOK_SECRET')) {
      this.logger.error(
        'STRIPE_WEBHOOK_SECRET is unset in production: refund and dispute ' +
          'reconciliation is dead. Set it from the endpoint signing secret ' +
          '(Stripe Dashboard > Developers > Webhooks).',
      );
    }
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

    // Reuse an existing intent so retries don't create duplicate charges. If
    // the stored id can't be found under the current Stripe key (key rotated or
    // account switched mid-testing → "No such payment_intent"), drop it and
    // fall through to create a fresh intent instead of failing the checkout.
    if (order.stripe_payment_intent_id) {
      try {
        const existing = await this.stripe.paymentIntents.retrieve(
          order.stripe_payment_intent_id,
        );
        if (existing.status !== 'canceled') {
          return { clientSecret: existing.client_secret };
        }
      } catch (err) {
        if (!isResourceMissing(err)) throw err;
        this.logger.warn(
          `Stored PaymentIntent ${order.stripe_payment_intent_id} not found for order ${order.id}; creating a new one.`,
        );
      }
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

    let intent: StripeNs.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.retrieve(
        order.stripe_payment_intent_id,
      );
    } catch (err) {
      if (!isResourceMissing(err)) throw err;
      // Stored intent no longer exists under the current key — can't confirm;
      // leave the order pending for the webhook / a fresh checkout to resolve.
      this.logger.warn(
        `Cannot confirm order ${order.id}: PaymentIntent ${order.stripe_payment_intent_id} not found.`,
      );
      return { status: 'pending' };
    }

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
   * Prices the cart and creates a Stripe PaymentIntent for it, staging the
   * cart as an `order_drafts` row instead of a real `orders` row. Unlike
   * `createIntent`, there is no "reuse an existing intent" branch: each call
   * prices and stages a brand-new draft, since there is no prior order to
   * retry against. A retry within the same checkout attempt is handled
   * entirely client-side (re-presenting the already-initialized sheet).
   */
  async createIntentDraft(
    userId: string,
    dto: CreateOrderDto,
    isB2b: boolean,
  ): Promise<{ clientSecret: string | null; draftId: string }> {
    const { draftId, clientAmountCents } = await this.orders.createDraft(
      userId,
      dto,
      isB2b,
    );

    const intent = await this.stripe.paymentIntents.create({
      amount: clientAmountCents,
      currency: 'eur',
      metadata: { draftId },
      automatic_payment_methods: { enabled: true },
    });

    await this.supabase.client
      .from('order_drafts')
      .update({ stripe_payment_intent_id: intent.id })
      .eq('id', draftId);

    return { clientSecret: intent.client_secret, draftId };
  }

  /**
   * Server-side reconciliation right after the client's Payment Sheet reports
   * success, for the deferred-order-creation flow. Re-verifies the
   * PaymentIntent with Stripe (never trusts the client) and only then turns
   * the draft into a real, paid order. The webhook is the backstop if this
   * never runs (app killed right after payment).
   */
  async confirmDraft(
    userId: string,
    draftId: string,
  ): Promise<{ status: 'paid'; order: OrderDto } | { status: 'pending' }> {
    const { data: draft } = await this.supabase.client
      .from('order_drafts')
      .select('id, profile_id, order_id, stripe_payment_intent_id')
      .eq('id', draftId)
      .maybeSingle<{
        id: string;
        profile_id: string;
        order_id: string | null;
        stripe_payment_intent_id: string | null;
      }>();

    if (!draft || draft.profile_id !== userId) {
      throw new NotFoundException('Commande introuvable');
    }

    if (!draft.order_id) {
      if (!draft.stripe_payment_intent_id) {
        throw new BadRequestException('Aucun paiement à confirmer');
      }
      let intent: StripeNs.PaymentIntent;
      try {
        intent = await this.stripe.paymentIntents.retrieve(
          draft.stripe_payment_intent_id,
        );
      } catch (err) {
        if (!isResourceMissing(err)) throw err;
        this.logger.warn(
          `Cannot confirm draft ${draftId}: PaymentIntent ${draft.stripe_payment_intent_id} not found.`,
        );
        return { status: 'pending' };
      }
      if (intent.status !== 'succeeded') return { status: 'pending' };
    }

    const order = await this.orders.finalizeDraft(draftId);
    return order ? { status: 'paid', order } : { status: 'pending' };
  }

  /**
   * Issues a Stripe refund for a paid order.
   *
   * Idempotent: if the order already has a stripe_refund_id we return it
   * without calling Stripe again, so a double "accept" never double-refunds.
   * Throws if the order isn't paid or has no PaymentIntent to refund.
   *
   * Returns the **settlement** rather than assuming success. A card refund
   * comes back `pending` and takes days to reach the customer; only the
   * `refund.updated` / `charge.refunded` webhooks can say it truly landed, so
   * the order is not marked refunded here unless Stripe already says succeeded.
   */
  async refundOrder(
    orderId: string,
    amountCents?: number,
  ): Promise<{
    refundId: string;
    amountCents: number;
    partial: boolean;
    settlement: RefundSettlement;
  }> {
    const { data: order } = await this.supabase.client
      .from('orders')
      .select(
        'id, total_cents, payment_status, stripe_payment_intent_id, stripe_refund_id, refund_amount_cents, refund_settlement, refund_status',
      )
      .eq('id', orderId)
      .maybeSingle<OrderRefundRow>();

    if (!order) throw new NotFoundException('Commande introuvable');

    // Already refunded → return the existing refund (idempotent, one per order).
    if (order.stripe_refund_id) {
      const done = order.refund_amount_cents ?? order.total_cents;
      return {
        refundId: order.stripe_refund_id,
        amountCents: done,
        partial: done < order.total_cents,
        settlement: order.refund_settlement ?? 'succeeded',
      };
    }
    if (order.payment_status !== 'paid') {
      throw new BadRequestException(
        'Seules les commandes payées peuvent être remboursées',
      );
    }
    if (!order.stripe_payment_intent_id) {
      throw new BadRequestException(
        'Aucun paiement Stripe associé à cette commande',
      );
    }

    // Resolve the amount: a partial refund must be > 0 and ≤ the order total.
    let resolved = order.total_cents;
    if (amountCents != null) {
      if (amountCents <= 0 || amountCents > order.total_cents) {
        throw new BadRequestException(
          'Le montant du remboursement doit être compris entre 1 et le total de la commande',
        );
      }
      resolved = Math.round(amountCents);
    }
    const partial = resolved < order.total_cents;

    let refund: StripeNs.Refund;
    try {
      refund = await this.stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        ...(partial ? { amount: resolved } : {}),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Échec du remboursement Stripe';
      this.logger.error(
        `Stripe refund failed for order ${order.id}: ${message}`,
      );
      throw new BadRequestException(`Remboursement Stripe impossible: ${message}`);
    }

    // What Stripe says *right now*. Cards normally answer `pending`; only the
    // webhook that follows can promote this to succeeded.
    const settlement = settlementFromStripe(refund.status ?? 'pending');
    const refundedTotal =
      settlement === 'succeeded'
        ? mergeRefundedTotal(order.refund_amount_cents ?? 0, resolved)
        : 0;

    await this.supabase.client
      .from('orders')
      .update({
        stripe_refund_id: refund.id,
        refund_settlement: settlement,
        refunded_total_cents: refundedTotal,
        refund_amount_cents: resolved,
        // Only a settled, full refund stops the order counting as paid. A
        // pending one leaves it paid: the money has not moved yet.
        payment_status: paymentStatusForRefund(
          order.payment_status,
          settlement,
          refundedTotal,
          order.total_cents,
        ),
      })
      .eq('id', order.id);

    return { refundId: refund.id, amountCents: resolved, partial, settlement };
  }

  /**
   * Verifies the Stripe webhook signature and reconciles the order's money
   * state.
   *
   * Stripe delivers at-least-once and in no guaranteed order, so every handler
   * below is written to be replay-safe on its own *and* the event id is claimed
   * in `stripe_webhook_events` before any of them runs. A duplicate returns
   * early; a genuinely new event that then throws leaves a claimed row behind,
   * which is the safe direction — Stripe retries, we return 200, and nothing is
   * applied twice.
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true }> {
    // An unset secret is defaulted to '' by env.validation, and Stripe's
    // verifier reports that as an ordinary "no signatures found matching" —
    // indistinguishable from a healthy endpoint being probed with a bogus
    // signature. Saying so explicitly is what makes "is the secret actually
    // set in production?" answerable from outside, without a real delivery.
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.error(
        'Webhook delivery refused: STRIPE_WEBHOOK_SECRET is not configured.',
      );
      throw new BadRequestException(
        'Webhook secret not configured on this deployment',
      );
    }

    let event: StripeNs.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid signature';
      throw new BadRequestException(`Webhook signature error: ${message}`);
    }

    // `whsec_` carries no tier marker, so a live secret pasted into a dev
    // config (or the reverse) passes signature verification and would then
    // mutate the *shared* database from the wrong side. The event itself does
    // carry the tier, so check that instead of trusting the configuration.
    //
    // Answers 200 without claiming the event: retrying cannot fix a
    // misconfiguration, and claiming it would poison the ledger for the
    // correctly-configured deploy, which receives its own copy of the same
    // delivery and is the one that should apply it.
    if (event.livemode !== this.expectsLiveMode) {
      this.logger.error(
        `Refusing Stripe event ${event.id} (${event.type}): livemode=` +
          `${event.livemode} but this deploy is ` +
          `${this.expectsLiveMode ? 'production' : 'development'}. ` +
          'The STRIPE_WEBHOOK_SECRET here belongs to the other tier.',
      );
      return { received: true };
    }

    if (!(await this.claimEvent(event))) {
      this.logger.log(`Stripe event ${event.id} already processed; skipping.`);
      return { received: true };
    }

    try {
      await this.dispatch(event);
    } catch (err) {
      // Never 500 back to Stripe for a bug on our side: it would retry the same
      // event for days and fill the dashboard with failures. The claim row and
      // the log are what a human follows up on.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Stripe event ${event.id} (${event.type}) failed to apply: ${message}`,
      );
      await this.noteEventOutcome(event.id, `error: ${message}`.slice(0, 300));
    }

    return { received: true };
  }

  private async dispatch(event: StripeNs.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return this.onIntentSettled(
          event.data.object as StripeNs.PaymentIntent,
          'paid',
          event.id,
        );
      case 'payment_intent.payment_failed':
        return this.onIntentSettled(
          event.data.object as StripeNs.PaymentIntent,
          'failed',
          event.id,
        );

      // Fires for dashboard-issued refunds too, which is the whole point: the
      // back office is not the only way money leaves the account.
      case 'charge.refunded':
        return this.onChargeRefunded(
          event.data.object as StripeNs.Charge,
          event.id,
        );

      // `charge.refund.updated` is the legacy name for the same thing; both are
      // accepted so the endpoint works whichever the account emits.
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed':
      case 'charge.refund.updated':
        return this.onRefundChanged(
          event.data.object as StripeNs.Refund,
          event.id,
        );

      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed':
        return this.onDispute(
          event.data.object as StripeNs.Dispute,
          event.type,
          event.id,
        );

      default:
        await this.noteEventOutcome(event.id, 'ignored');
    }
  }

  // ── Event bookkeeping ─────────────────────────────────────────────────────

  /** False when this event id has already been recorded, i.e. it is a replay. */
  private async claimEvent(event: StripeNs.Event): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('stripe_webhook_events')
      .insert({ id: event.id, type: event.type });

    if (!error) return true;
    if (error.code === UNIQUE_VIOLATION) return false;

    // The ledger is unavailable. Processing anyway risks applying an event
    // twice; skipping risks never applying it at all. Stripe retries, so
    // refusing here is recoverable while a double-apply is not.
    this.logger.error(
      `Could not claim Stripe event ${event.id}: ${error.message}`,
    );
    throw new Error(`Webhook ledger unavailable: ${error.message}`);
  }

  private async noteEventOutcome(
    eventId: string,
    outcome: string,
    orderId?: string,
  ): Promise<void> {
    await this.supabase.client
      .from('stripe_webhook_events')
      .update({ outcome, ...(orderId ? { order_id: orderId } : {}) })
      .eq('id', eventId);
  }

  /**
   * Finds the order behind a Stripe object, by intent, charge or refund id.
   *
   * Charge- and refund-scoped events do not always carry the PaymentIntent, and
   * an order only learns its charge id the first time one arrives — so all
   * three are tried before giving up.
   */
  private async findOrder(refs: {
    intentId?: string | null;
    chargeId?: string | null;
    refundId?: string | null;
  }): Promise<OrderMoneyRow | null> {
    const lookups: [string, string][] = [
      ['stripe_payment_intent_id', refs.intentId ?? ''],
      ['stripe_charge_id', refs.chargeId ?? ''],
      ['stripe_refund_id', refs.refundId ?? ''],
    ];

    for (const [column, value] of lookups) {
      if (!value) continue;
      const { data } = await this.supabase.client
        .from('orders')
        .select(MONEY_COLUMNS)
        .eq(column, value)
        .maybeSingle<OrderMoneyRow>();
      if (data) return data;
    }
    return null;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** A PaymentIntent reached a terminal state. */
  private async onIntentSettled(
    intent: StripeNs.PaymentIntent,
    status: 'paid' | 'failed',
    eventId: string,
  ): Promise<void> {
    const chargeId = idOf(
      intent.latest_charge as string | { id: string } | null | undefined,
    );
    const orderId = intent.metadata?.orderId;

    const order = orderId
      ? await this.findOrderById(orderId)
      : await this.findOrder({ intentId: intent.id, chargeId });

    if (!order) {
      // No order exists yet — expected under the deferred-creation flow when
      // this event arrives before the client's own confirm-draft call could
      // run (e.g. the app was killed right after the Payment Sheet closed).
      // If the intent carries a draftId, finalize it here as the backstop. A
      // failed intent must never produce an order.
      const draftId = intent.metadata?.draftId;
      if (status === 'paid' && draftId) {
        try {
          const finalized = await this.orders.finalizeDraft(draftId);
          await this.noteEventOutcome(
            eventId,
            finalized
              ? `draft ${draftId} finalized -> order ${finalized.id}`
              : `draft ${draftId} finalize still pending`,
            finalized?.id,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Could not finalize draft ${draftId} from webhook: ${message}`,
          );
          await this.noteEventOutcome(
            eventId,
            `draft finalize failed: ${message}`.slice(0, 300),
          );
        }
        return;
      }
      this.logger.warn(
        `No order for PaymentIntent ${intent.id}; event ${eventId} ignored.`,
      );
      await this.noteEventOutcome(eventId, 'no matching order');
      return;
    }

    // A refunded or disputed order must not be dragged back to "paid" by a
    // late-arriving success for the very charge that was already reversed.
    const patch: Record<string, unknown> = {
      ...(chargeId ? { stripe_charge_id: chargeId } : {}),
    };
    if (order.payment_status !== 'refunded' && order.dispute_status !== 'lost') {
      patch.payment_status = status;
    }

    await this.updateOrder(order.id, patch);
    await this.noteEventOutcome(
      eventId,
      `payment_status=${patch.payment_status ?? order.payment_status}`,
      order.id,
    );
  }

  /**
   * A charge was refunded — by us, or by someone in the Stripe dashboard.
   *
   * `charge.amount_refunded` is cumulative and authoritative, so it is the
   * figure trusted for the running total rather than anything we recorded when
   * asking for the refund.
   */
  private async onChargeRefunded(
    charge: StripeNs.Charge,
    eventId: string,
  ): Promise<void> {
    const intentId = idOf(
      charge.payment_intent as string | { id: string } | null | undefined,
    );
    const order = await this.findOrder({ intentId, chargeId: charge.id });

    if (!order) {
      this.logger.warn(
        `No order for charge ${charge.id}; event ${eventId} ignored.`,
      );
      await this.noteEventOutcome(eventId, 'no matching order');
      return;
    }

    const refundedTotal = mergeRefundedTotal(
      order.refunded_total_cents ?? 0,
      charge.amount_refunded ?? 0,
    );

    // `charge.amount_refunded` grows the moment a refund is *created*, not when
    // the bank settles it — so this event proves a refund exists, never that the
    // customer has their money. Claiming otherwise here would reintroduce the
    // very bug this iteration removes.
    //
    // Rather than assume, the refunds are read back from Stripe. That keeps
    // this handler correct on its own: an endpoint not subscribed to
    // `refund.updated` would otherwise leave every refund stuck at "pending"
    // forever, and webhook subscriptions are edited by hand in a dashboard.
    const incoming = await this.settlementForCharge(charge);
    const settlement = advanceSettlement(
      order.refund_settlement ?? 'none',
      incoming,
    );
    const effective = settlement ?? order.refund_settlement ?? 'none';
    const refundStatus = refundStatusFor(effective, order.refund_status);
    const paymentStatus = paymentStatusForRefund(
      order.payment_status,
      effective,
      refundedTotal,
      order.total_cents,
    );

    await this.updateOrder(order.id, {
      stripe_charge_id: charge.id,
      refunded_total_cents: refundedTotal,
      refund_settlement: effective,
      refund_status: refundStatus,
      payment_status: paymentStatus,
      refund_amount_cents: refundedTotal,
    });

    if (effective === 'failed') {
      await this.addOrderNote(
        order.id,
        `⚠️ Un remboursement sur la charge ${charge.id} a ÉCHOUÉ. ` +
          `Le client n'a pas été remboursé — une action est requise.`,
      );
      await this.activity.log({
        kind: 'order',
        summary: `Échec de remboursement constaté sur ${order.order_number}`,
        entityRef: order.id,
        action: 'refund.failed',
        meta: { chargeId: charge.id },
      });
    }

    // A refund we never asked for came from the dashboard. Say so in the audit
    // trail, because otherwise the back office shows a refunded order with no
    // record of who decided it.
    const external = !order.stripe_refund_id;
    if (external) {
      await this.addOrderNote(
        order.id,
        `Remboursement de ${(refundedTotal / 100).toFixed(2)} € constaté depuis Stripe ` +
          `(hors back-office) sur la charge ${charge.id}.`,
      );
      await this.activity.log({
        kind: 'order',
        summary: `Remboursement Stripe externe sur ${order.order_number}`,
        entityRef: order.id,
        action: 'refund.external',
        meta: { chargeId: charge.id, refundedTotal },
      });
    }

    await this.noteEventOutcome(
      eventId,
      `refunded_total=${refundedTotal} payment=${paymentStatus}`,
      order.id,
    );
  }

  /**
   * A single refund object moved — most importantly, failed.
   *
   * `refunds.create` returns `pending` for card refunds and the bank can still
   * reject it days later. This is the only signal that ever tells us so.
   */
  private async onRefundChanged(
    refund: StripeNs.Refund,
    eventId: string,
  ): Promise<void> {
    const intentId = idOf(
      refund.payment_intent as string | { id: string } | null | undefined,
    );
    const chargeId = idOf(
      refund.charge as string | { id: string } | null | undefined,
    );
    const order = await this.findOrder({
      intentId,
      chargeId,
      refundId: refund.id,
    });

    if (!order) {
      this.logger.warn(
        `No order for refund ${refund.id}; event ${eventId} ignored.`,
      );
      await this.noteEventOutcome(eventId, 'no matching order');
      return;
    }

    const incoming = settlementFromStripe(refund.status ?? 'pending');
    const settlement = advanceSettlement(
      order.refund_settlement ?? 'none',
      incoming,
    );

    if (!settlement) {
      await this.noteEventOutcome(
        eventId,
        `stale (${incoming} behind ${order.refund_settlement})`,
        order.id,
      );
      return;
    }

    const refundStatus = refundStatusFor(settlement, order.refund_status);
    const refundedTotal =
      settlement === 'succeeded'
        ? mergeRefundedTotal(order.refunded_total_cents ?? 0, refund.amount ?? 0)
        : (order.refunded_total_cents ?? 0);
    const paymentStatus = paymentStatusForRefund(
      order.payment_status,
      settlement,
      refundedTotal,
      order.total_cents,
    );

    await this.updateOrder(order.id, {
      stripe_refund_id: refund.id,
      ...(chargeId ? { stripe_charge_id: chargeId } : {}),
      refund_settlement: settlement,
      refund_status: refundStatus,
      payment_status: paymentStatus,
      refunded_total_cents: refundedTotal,
      refund_failure_reason:
        settlement === 'failed' ? (refund.failure_reason ?? 'inconnue') : null,
    });

    if (settlement === 'failed') {
      const reason = refund.failure_reason ?? 'raison non précisée';
      await this.addOrderNote(
        order.id,
        `⚠️ Le remboursement Stripe ${refund.id} a ÉCHOUÉ (${reason}). ` +
          `Le client n'a pas été remboursé — une action est requise.`,
      );
      await this.activity.log({
        kind: 'order',
        summary: `Échec du remboursement sur ${order.order_number} (${reason})`,
        entityRef: order.id,
        action: 'refund.failed',
        meta: { refundId: refund.id, reason },
      });
      this.logger.error(
        `Refund ${refund.id} FAILED for order ${order.order_number}: ${reason}`,
      );
    }

    if (settlement === 'succeeded') {
      await this.addOrderNote(
        order.id,
        `Remboursement ${refund.id} confirmé par la banque ` +
          `(${((refund.amount ?? 0) / 100).toFixed(2)} €).`,
      );
    }

    await this.noteEventOutcome(eventId, `settlement=${settlement}`, order.id);
  }

  /** A chargeback was opened, updated or closed. */
  private async onDispute(
    dispute: StripeNs.Dispute,
    eventType: string,
    eventId: string,
  ): Promise<void> {
    const intentId = idOf(
      dispute.payment_intent as string | { id: string } | null | undefined,
    );
    const chargeId = idOf(
      dispute.charge as string | { id: string } | null | undefined,
    );
    const order = await this.findOrder({ intentId, chargeId });

    if (!order) {
      this.logger.warn(
        `No order for dispute ${dispute.id}; event ${eventId} ignored.`,
      );
      await this.noteEventOutcome(eventId, 'no matching order');
      return;
    }

    const incoming = disputeStatusFromStripe(dispute.status ?? '');
    const next = advanceDispute(order.dispute_status ?? 'none', incoming);

    if (!next) {
      await this.noteEventOutcome(
        eventId,
        `stale dispute (${incoming} after ${order.dispute_status})`,
        order.id,
      );
      return;
    }

    const dueBy = dispute.evidence_details?.due_by;
    await this.updateOrder(order.id, {
      stripe_dispute_id: dispute.id,
      ...(chargeId ? { stripe_charge_id: chargeId } : {}),
      dispute_status: next,
      dispute_reason: dispute.reason ?? null,
      dispute_amount_cents: dispute.amount ?? null,
      dispute_evidence_due_at: dueBy
        ? new Date(dueBy * 1000).toISOString()
        : null,
    });

    const amount = ((dispute.amount ?? 0) / 100).toFixed(2);
    const note =
      next === 'open'
        ? `⚠️ Litige bancaire ouvert sur cette commande (${amount} €, motif : ` +
          `${dispute.reason ?? 'non précisé'}).` +
          (dueBy
            ? ` Preuves à fournir avant le ${new Date(dueBy * 1000).toLocaleDateString('fr-FR')}.`
            : '')
        : next === 'lost'
          ? `⚠️ Litige bancaire PERDU (${amount} €). Les fonds ont été repris par la banque.`
          : `Litige bancaire clos en votre faveur (${amount} €).`;

    await this.addOrderNote(order.id, note);
    await this.activity.log({
      kind: 'order',
      summary: `Litige ${next} sur ${order.order_number} (${amount} €)`,
      entityRef: order.id,
      action: `dispute.${next}`,
      meta: { disputeId: dispute.id, reason: dispute.reason, eventType },
    });

    if (next !== 'won') {
      this.logger.error(
        `Dispute ${dispute.id} ${next} on order ${order.order_number} (${amount} EUR)`,
      );
    }

    await this.noteEventOutcome(eventId, `dispute=${next}`, order.id);
  }

  // ── Small shared helpers ──────────────────────────────────────────────────

  /**
   * The true settlement of a charge, read from Stripe rather than inferred.
   *
   * A charge can carry several refunds (partial ones, or a retry after a
   * failure), so the worst outcome wins: one failed refund means somebody is
   * owed money, and that has to surface even when its siblings succeeded.
   * Falls back to `pending` if the read fails — never to `succeeded`, which
   * would be a claim we cannot support.
   */
  private async settlementForCharge(
    charge: StripeNs.Charge,
  ): Promise<RefundSettlement> {
    try {
      const refunds = await this.stripe.refunds.list({
        charge: charge.id,
        limit: 100,
      });
      const statuses = refunds.data.map((r) =>
        settlementFromStripe(r.status ?? 'pending'),
      );
      if (statuses.length === 0) return 'pending';
      if (statuses.includes('failed')) return 'failed';
      const live = statuses.filter((st) => st !== 'canceled');
      if (live.length === 0) return 'canceled';
      return live.every((st) => st === 'succeeded') ? 'succeeded' : 'pending';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not read refunds for charge ${charge.id} (${message}); ` +
          `treating the refund as still pending.`,
      );
      return 'pending';
    }
  }

  private async findOrderById(id: string): Promise<OrderMoneyRow | null> {
    const { data } = await this.supabase.client
      .from('orders')
      .select(MONEY_COLUMNS)
      .eq('id', id)
      .maybeSingle<OrderMoneyRow>();
    return data ?? null;
  }

  private async updateOrder(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    const { error } = await this.supabase.client
      .from('orders')
      .update(patch)
      .eq('id', id);
    if (error) {
      throw new Error(`Order ${id} update failed: ${error.message}`);
    }
  }

  private async addOrderNote(orderId: string, body: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('order_notes')
      .insert({ order_id: orderId, body });
    if (error) {
      // An audit note is not worth failing the reconciliation over.
      this.logger.warn(
        `Could not add note to order ${orderId}: ${error.message}`,
      );
    }
  }
}
