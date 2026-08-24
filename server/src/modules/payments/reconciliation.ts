/**
 * The rules that decide what an order's money state becomes when Stripe tells
 * us something changed.
 *
 * Pure on purpose — no Stripe client, no database. Webhooks are the one place
 * where getting it wrong means real money in the wrong place, and the failure
 * modes (a replayed event, two events landing out of order) are precisely the
 * ones that are miserable to reproduce against a live integration. Everything
 * here is a function of (current state, incoming state) so it can be tested
 * exhaustively in `reconciliation.spec.ts`.
 */

/** Where a refund is with the bank. Mirrors Stripe's `Refund.status`. */
export type RefundSettlement =
  | 'none'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'canceled';

/**
 * What the customer is shown. Deliberately the four values the **published**
 * mobile app already knows: it does an unguarded `REFUND_BANNER[status].icon`
 * lookup, so an unknown value crashes its order screen. New states belong in
 * `RefundSettlement`, which only the back office reads.
 */
export type RefundStatus = 'none' | 'requested' | 'refunded' | 'rejected';

export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

export type DisputeStatus = 'none' | 'open' | 'won' | 'lost';

/**
 * How far along a settlement is. A later event may only move a refund *forward*
 * through this order, which is what makes replays and out-of-order delivery
 * harmless: Stripe often sends `pending` and `succeeded` close enough together
 * that they arrive reversed, and without this a settled refund would be dragged
 * back to pending.
 *
 * `failed` ranks above `succeeded` on purpose. It is the one transition that
 * must never be swallowed — a refund the bank bounced needs a human, and the
 * cost of showing a spurious failure (someone looks, sees it is fine) is far
 * below the cost of hiding a real one (the customer is never repaid).
 */
const SETTLEMENT_RANK: Record<RefundSettlement, number> = {
  none: 0,
  pending: 1,
  canceled: 2,
  succeeded: 3,
  failed: 4,
};

/** Stripe's vocabulary is wider than ours; `requires_action` is still pending. */
export function settlementFromStripe(status: string): RefundSettlement {
  switch (status) {
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    case 'pending':
    case 'requires_action':
      return 'pending';
    default:
      // An unrecognised status is treated as still in flight rather than as a
      // finished refund: it keeps the order in the back office's queue.
      return 'pending';
  }
}

/**
 * The settlement to store, or `null` when the incoming event is stale and must
 * be ignored.
 */
export function advanceSettlement(
  current: RefundSettlement,
  incoming: RefundSettlement,
): RefundSettlement | null {
  return SETTLEMENT_RANK[incoming] >= SETTLEMENT_RANK[current]
    ? incoming
    : null;
}

/**
 * What the customer sees, given where the money actually is.
 *
 * Only a *settled* refund is ever reported as "effectué". A card refund comes
 * back from `refunds.create` as `pending` and takes days to reach the customer;
 * announcing it as done at that point is a promise Stripe has not made yet, and
 * the previous implementation made it on every refund.
 *
 * A refund that fails or is cancelled after being announced is pulled back to
 * `requested`, never to `none` — `none` would hide it from the back office's
 * refund queue, which is exactly when someone needs to act on it.
 */
export function refundStatusFor(
  settlement: RefundSettlement,
  current: RefundStatus,
): RefundStatus {
  if (settlement === 'succeeded') return 'refunded';
  if (current === 'refunded') return 'requested';
  return current;
}

/**
 * Whether the money has fully left your account, which is what decides if the
 * order still counts as paid.
 *
 * A partial refund leaves the order paid: goods were still sold, and the books
 * should say so. Only a refund covering the whole total flips it.
 */
export function paymentStatusForRefund(
  current: PaymentStatus,
  settlement: RefundSettlement,
  refundedTotalCents: number,
  orderTotalCents: number,
): PaymentStatus {
  // Never resurrect an order that was never paid in the first place.
  if (current === 'unpaid' || current === 'failed') return current;

  const fullySettled =
    settlement === 'succeeded' &&
    orderTotalCents > 0 &&
    refundedTotalCents >= orderTotalCents;

  if (fullySettled) return 'refunded';

  // The refund fell through (or was only partial): the charge stands.
  return 'paid';
}

/**
 * Stripe's dispute vocabulary collapsed to the four outcomes the back office
 * acts on.
 *
 * `warning_closed` is an early-warning that never became a real dispute — no
 * funds were ever withdrawn — so it counts as won rather than lingering as an
 * open item someone has to chase.
 */
export function disputeStatusFromStripe(status: string): DisputeStatus {
  switch (status) {
    case 'won':
    case 'warning_closed':
      return 'won';
    case 'lost':
      return 'lost';
    case 'needs_response':
    case 'under_review':
    case 'warning_needs_response':
    case 'warning_under_review':
      return 'open';
    default:
      // Unknown means unresolved: keep it visible.
      return 'open';
  }
}

/**
 * A dispute may not be un-resolved. Once Stripe has said won or lost the money
 * has moved for good, and a late-arriving `dispute.created` replay must not
 * reopen it.
 */
export function advanceDispute(
  current: DisputeStatus,
  incoming: DisputeStatus,
): DisputeStatus | null {
  if (current === 'won' || current === 'lost') return null;
  if (incoming === current) return null;
  return incoming;
}

/**
 * Refund totals only ever grow: `charge.amount_refunded` is cumulative, so the
 * highest figure seen is the true one no matter what order events arrive in.
 */
export function mergeRefundedTotal(current: number, incoming: number): number {
  return Math.max(current, Number.isFinite(incoming) ? incoming : 0);
}

/** Whether this state needs a human to look at it. */
export function needsAttention(state: {
  refundSettlement: RefundSettlement;
  disputeStatus: DisputeStatus;
}): boolean {
  return state.refundSettlement === 'failed' || state.disputeStatus === 'open';
}
