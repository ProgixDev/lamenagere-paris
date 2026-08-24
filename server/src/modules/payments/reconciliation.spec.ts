import {
  advanceDispute,
  advanceSettlement,
  disputeStatusFromStripe,
  mergeRefundedTotal,
  needsAttention,
  paymentStatusForRefund,
  refundStatusFor,
  settlementFromStripe,
  type PaymentStatus,
  type RefundSettlement,
  type RefundStatus,
} from './reconciliation';

/**
 * The money state machine, exercised the way Stripe actually behaves: events
 * replayed, events reversed, and the two cases that used to be silent — a
 * refund that never settles, and a chargeback.
 */
describe('refund settlement', () => {
  it('maps every Stripe refund status', () => {
    expect(settlementFromStripe('succeeded')).toBe('succeeded');
    expect(settlementFromStripe('failed')).toBe('failed');
    expect(settlementFromStripe('canceled')).toBe('canceled');
    expect(settlementFromStripe('pending')).toBe('pending');
    expect(settlementFromStripe('requires_action')).toBe('pending');
  });

  it('treats an unknown status as still in flight, never as done', () => {
    expect(settlementFromStripe('something_new')).toBe('pending');
  });

  it('advances forward', () => {
    expect(advanceSettlement('none', 'pending')).toBe('pending');
    expect(advanceSettlement('pending', 'succeeded')).toBe('succeeded');
  });

  it('ignores a stale pending that arrives after success', () => {
    // Stripe sends pending and succeeded within moments of each other; they
    // regularly arrive reversed.
    expect(advanceSettlement('succeeded', 'pending')).toBeNull();
  });

  it('is idempotent for a replayed event', () => {
    expect(advanceSettlement('succeeded', 'succeeded')).toBe('succeeded');
  });

  it('always lets a failure through, even after success', () => {
    // The one transition that must never be swallowed: money owed to a
    // customer that never arrived.
    expect(advanceSettlement('succeeded', 'failed')).toBe('failed');
  });

  it('does not let a cancellation override a settled refund', () => {
    expect(advanceSettlement('succeeded', 'canceled')).toBeNull();
  });
});

describe('what the customer is shown', () => {
  it('only reports "refunded" once the money actually settled', () => {
    expect(refundStatusFor('pending', 'requested')).toBe('requested');
    expect(refundStatusFor('succeeded', 'requested')).toBe('refunded');
  });

  it('pulls a refund back to requested when it later fails', () => {
    // Not to 'none': that would drop it out of the back office's queue at
    // exactly the moment somebody needs to act on it.
    expect(refundStatusFor('failed', 'refunded')).toBe('requested');
    expect(refundStatusFor('canceled', 'refunded')).toBe('requested');
  });

  it('leaves an untouched order alone while a refund is in flight', () => {
    expect(refundStatusFor('pending', 'none')).toBe('none');
  });

  it('never invents a status the published app cannot render', () => {
    const allowed: RefundStatus[] = [
      'none',
      'requested',
      'refunded',
      'rejected',
    ];
    const settlements: RefundSettlement[] = [
      'none',
      'pending',
      'succeeded',
      'failed',
      'canceled',
    ];
    for (const s of settlements) {
      for (const c of allowed) {
        expect(allowed).toContain(refundStatusFor(s, c));
      }
    }
  });
});

describe('payment status after a refund', () => {
  const TOTAL = 10_000;

  it('flips to refunded only on a settled full refund', () => {
    expect(paymentStatusForRefund('paid', 'succeeded', TOTAL, TOTAL)).toBe(
      'refunded',
    );
  });

  it('stays paid while the refund is merely pending', () => {
    expect(paymentStatusForRefund('paid', 'pending', 0, TOTAL)).toBe('paid');
  });

  it('stays paid for a partial refund', () => {
    expect(paymentStatusForRefund('paid', 'succeeded', 4_000, TOTAL)).toBe(
      'paid',
    );
  });

  it('returns to paid when a refund fails after being announced', () => {
    expect(paymentStatusForRefund('refunded', 'failed', 0, TOTAL)).toBe('paid');
  });

  it('never resurrects an order that was never paid', () => {
    const never: PaymentStatus[] = ['unpaid', 'failed'];
    for (const s of never) {
      expect(paymentStatusForRefund(s, 'succeeded', TOTAL, TOTAL)).toBe(s);
    }
  });

  it('does not divide by a zero total', () => {
    expect(paymentStatusForRefund('paid', 'succeeded', 0, 0)).toBe('paid');
  });
});

describe('refund totals', () => {
  it('only ever grows, so out-of-order charge events cannot shrink it', () => {
    expect(mergeRefundedTotal(5_000, 8_000)).toBe(8_000);
    expect(mergeRefundedTotal(8_000, 5_000)).toBe(8_000);
  });

  it('survives a missing or nonsense amount', () => {
    expect(mergeRefundedTotal(5_000, Number.NaN)).toBe(5_000);
  });
});

describe('disputes', () => {
  it('maps Stripe dispute statuses', () => {
    expect(disputeStatusFromStripe('needs_response')).toBe('open');
    expect(disputeStatusFromStripe('under_review')).toBe('open');
    expect(disputeStatusFromStripe('won')).toBe('won');
    expect(disputeStatusFromStripe('lost')).toBe('lost');
  });

  it('counts an early warning that closed as won — no funds were taken', () => {
    expect(disputeStatusFromStripe('warning_closed')).toBe('won');
  });

  it('keeps an unknown status visible rather than resolving it', () => {
    expect(disputeStatusFromStripe('brand_new_state')).toBe('open');
  });

  it('never reopens a closed dispute', () => {
    expect(advanceDispute('won', 'open')).toBeNull();
    expect(advanceDispute('lost', 'open')).toBeNull();
  });

  it('does not rewrite an unchanged status', () => {
    expect(advanceDispute('open', 'open')).toBeNull();
  });

  it('closes an open dispute', () => {
    expect(advanceDispute('open', 'lost')).toBe('lost');
    expect(advanceDispute('none', 'open')).toBe('open');
  });
});

/**
 * `settlementForCharge` collapses every refund on a charge into one verdict.
 * Mirrored here as a pure function so the precedence rules are pinned down;
 * the service version differs only in fetching the list from Stripe.
 */
function verdict(statuses: string[]): RefundSettlement {
  const mapped = statuses.map(settlementFromStripe);
  if (mapped.length === 0) return 'pending';
  if (mapped.includes('failed')) return 'failed';
  const live = mapped.filter((st) => st !== 'canceled');
  if (live.length === 0) return 'canceled';
  return live.every((st) => st === 'succeeded') ? 'succeeded' : 'pending';
}

describe('settlement of a charge carrying several refunds', () => {
  it('settles only when every live refund has', () => {
    expect(verdict(['succeeded'])).toBe('succeeded');
    expect(verdict(['succeeded', 'succeeded'])).toBe('succeeded');
  });

  it('stays pending while any refund is still in flight', () => {
    expect(verdict(['succeeded', 'pending'])).toBe('pending');
  });

  it('lets one failure outrank its successful siblings', () => {
    // Someone is owed money; that must surface even amongst successes.
    expect(verdict(['succeeded', 'failed'])).toBe('failed');
  });

  it('ignores cancelled refunds when judging the rest', () => {
    expect(verdict(['canceled', 'succeeded'])).toBe('succeeded');
    expect(verdict(['canceled'])).toBe('canceled');
  });

  it('never reports success for a charge with no refunds', () => {
    expect(verdict([])).toBe('pending');
  });
});

describe('needsAttention', () => {
  it('flags a failed refund and an open dispute, nothing else', () => {
    expect(
      needsAttention({ refundSettlement: 'failed', disputeStatus: 'none' }),
    ).toBe(true);
    expect(
      needsAttention({ refundSettlement: 'none', disputeStatus: 'open' }),
    ).toBe(true);
    expect(
      needsAttention({ refundSettlement: 'succeeded', disputeStatus: 'won' }),
    ).toBe(false);
  });
});

describe('end-to-end sequences', () => {
  /** Applies a stream of refund events the way the service does. */
  function replay(
    events: RefundSettlement[],
    start: { settlement: RefundSettlement; refund: RefundStatus },
  ) {
    let settlement = start.settlement;
    let refund = start.refund;
    for (const incoming of events) {
      const next = advanceSettlement(settlement, incoming);
      if (!next) continue;
      settlement = next;
      refund = refundStatusFor(settlement, refund);
    }
    return { settlement, refund };
  }

  it('normal card refund: pending then succeeded', () => {
    expect(
      replay(['pending', 'succeeded'], {
        settlement: 'none',
        refund: 'requested',
      }),
    ).toEqual({ settlement: 'succeeded', refund: 'refunded' });
  });

  it('same events delivered out of order reach the same place', () => {
    expect(
      replay(['succeeded', 'pending'], {
        settlement: 'none',
        refund: 'requested',
      }),
    ).toEqual({ settlement: 'succeeded', refund: 'refunded' });
  });

  it('duplicate deliveries change nothing', () => {
    expect(
      replay(['pending', 'pending', 'succeeded', 'succeeded'], {
        settlement: 'none',
        refund: 'requested',
      }),
    ).toEqual({ settlement: 'succeeded', refund: 'refunded' });
  });

  it('a charge.refunded arriving first does not claim the money moved', () => {
    // charge.amount_refunded grows when the refund is created, so this event
    // alone must never reach 'refunded' — the customer has nothing yet.
    const afterCharge = replay(['pending'], {
      settlement: 'none',
      refund: 'requested',
    });
    expect(afterCharge).toEqual({ settlement: 'pending', refund: 'requested' });
    expect(
      paymentStatusForRefund('paid', afterCharge.settlement, 10_000, 10_000),
    ).toBe('paid');

    // …and the refund.updated that follows is what settles it.
    const afterRefund = replay(['succeeded'], afterCharge);
    expect(afterRefund).toEqual({ settlement: 'succeeded', refund: 'refunded' });
    expect(
      paymentStatusForRefund('paid', afterRefund.settlement, 10_000, 10_000),
    ).toBe('refunded');
  });

  it('a refund that settles then bounces ends up needing a human', () => {
    const end = replay(['pending', 'succeeded', 'failed'], {
      settlement: 'none',
      refund: 'requested',
    });
    expect(end).toEqual({ settlement: 'failed', refund: 'requested' });
    expect(
      needsAttention({
        refundSettlement: end.settlement,
        disputeStatus: 'none',
      }),
    ).toBe(true);
  });
});
