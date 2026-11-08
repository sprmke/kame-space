import { describe, expect, it } from 'vitest';

import {
  manilaCheckInInstant,
  manilaYmdFromDate,
  buildCancellationDeadlines,
  cancellationMoneyInputFromBooking,
  computeCancellationOutcome,
  type CancellationMoneyInput,
} from '@/features/guest/trip/lib/cancellationRefund';
import { buildCancellationPreset } from '@/features/dashboard/org/lib/cancellationPolicy';

const CHECK_IN = '2026-11-20';

function money(overrides: Partial<CancellationMoneyInput> = {}): CancellationMoneyInput {
  return {
    bookingRate: 6000,
    downPayment: 2000,
    guestBalancePaid: 3000,
    securityDeposit: 1500,
    petFee: null,
    hasPets: false,
    additionalFee: null,
    voucherDiscount: null,
    bookingSource: 'direct',
    externalSource: null,
    checkInDate: CHECK_IN,
    ...overrides,
  };
}

function outcome(
  options: {
    policy?: ReturnType<typeof buildCancellationPreset> | null;
    booking?: Partial<CancellationMoneyInput>;
    cancelledAt?: string;
    initiator?: 'guest' | 'host' | 'ota' | 'system';
    overrideRefundPhp?: number | null;
    checkInTime?: string;
  } = {}
) {
  return computeCancellationOutcome({
    policy:
      options.policy === undefined ? buildCancellationPreset('flexible') : options.policy,
    booking: money(options.booking),
    cancelledAt: options.cancelledAt ?? '2026-11-18T00:00:00.000Z',
    checkInTime: options.checkInTime ?? '14:00',
    initiator: options.initiator ?? 'guest',
    overrideRefundPhp: options.overrideRefundPhp ?? null,
  });
}

describe('manilaCheckInInstant', () => {
  it('builds the Manila check-in instant at a fixed +08:00', () => {
    expect(manilaCheckInInstant('2026-11-20', '14:00')?.toISOString()).toBe(
      '2026-11-20T06:00:00.000Z'
    );
  });

  it('accepts legacy MM-DD-YYYY dates', () => {
    expect(manilaCheckInInstant('11-20-2026', '14:00')?.toISOString()).toBe(
      '2026-11-20T06:00:00.000Z'
    );
  });

  it('defaults to 14:00 and normalizes an early hour onto the previous UTC day', () => {
    expect(manilaCheckInInstant('2026-11-20')?.toISOString()).toBe('2026-11-20T06:00:00.000Z');
    expect(manilaCheckInInstant('2026-11-20', '02:00')?.toISOString()).toBe(
      '2026-11-19T18:00:00.000Z'
    );
  });

  it('returns null for an unparseable date', () => {
    expect(manilaCheckInInstant('')).toBeNull();
    expect(manilaCheckInInstant('20/11/2026')).toBeNull();
  });
});

describe('manilaYmdFromDate', () => {
  it('formats a date in Manila terms, not UTC', () => {
    expect(manilaYmdFromDate(new Date('2026-11-19T18:00:00.000Z'))).toBe('2026-11-20');
    expect(manilaYmdFromDate(new Date('2026-11-20T05:00:00.000Z'))).toBe('2026-11-20');
  });
});

describe('buildCancellationDeadlines', () => {
  it('lists deadlines furthest first, counting back from check-in', () => {
    const policy = buildCancellationPreset('firm');
    const deadlines = buildCancellationDeadlines(policy, new Date('2026-11-20T06:00:00.000Z'));

    expect(deadlines.map((deadline) => deadline.daysBefore)).toEqual([14, 7]);
    expect(deadlines[0]?.deadlineIso).toBe('2026-11-06T06:00:00.000Z');
    expect(deadlines[0]?.label).toBe('14 days before check-in');
    expect(deadlines[1]?.refundPercent).toBe(50);
  });
});

describe('computeCancellationOutcome', () => {
  it('hands an external channel booking back to the channel', () => {
    const value = outcome({ booking: { externalSource: 'airbnb' } });

    expect(value.mode).toBe('external');
    expect(value.appliedRule).toMatchObject({ kind: 'external' });
    expect(value.refundDuePhp).toBe(0);
    expect(value.amountPaidPhp).toBe(5000);
  });

  it('asks the host when there is no usable policy', () => {
    for (const policy of [null, buildCancellationPreset('custom')]) {
      const value = outcome({ policy });
      expect(value.mode).toBe('host_decides');
      expect(value.refundPercent).toBeNull();
    }

    const migrated = outcome({ policy: { ...buildCancellationPreset('custom'), needsReview: true } });
    expect(migrated.mode).toBe('host_decides');
  });

  it('refunds the matching tier, including the security deposit', () => {
    const value = outcome();

    expect(value.mode).toBe('computed');
    expect(value.refundPercent).toBe(100);
    expect(value.appliedRule?.kind).toBe('tier');
    expect(value.refundablePaidPhp).toBe(3500);
    expect(value.securityDepositHeldPhp).toBe(1500);
    expect(value.refundDuePhp).toBe(5000);
    expect(value.retainedPhp).toBe(0);
    expect(value.amountPaidPhp).toBe(5000);
  });

  it('falls back once the deadline has passed', () => {
    const policy = {
      ...buildCancellationPreset('custom', { tiers: [{ daysBefore: 7, refundPercent: 100 }] }),
      fallbackRefundPercent: 25,
    };
    const value = outcome({ policy, cancelledAt: '2026-11-18T00:00:00.000Z' });

    expect(value.appliedRule?.kind).toBe('fallback');
    expect(value.refundPercent).toBe(25);
    expect(value.refundDuePhp).toBe(2375);
    expect(value.retainedPhp).toBe(2625);
  });

  it('refunds nothing extra once the stay has started, but returns the deposit', () => {
    const value = outcome({ cancelledAt: '2026-11-20T07:00:00.000Z' });

    expect(value.mode).toBe('after_checkin');
    expect(value.refundPercent).toBe(0);
    expect(value.appliedRule).toMatchObject({ kind: 'after_checkin' });
    expect(value.refundDuePhp).toBe(1500);
    expect(value.retainedPhp).toBe(3500);
  });

  it('refunds everything paid when the host cancels', () => {
    const value = outcome({ initiator: 'host', cancelledAt: '2026-11-20T07:00:00.000Z' });

    expect(value.refundPercent).toBe(100);
    expect(value.appliedRule).toMatchObject({ kind: 'host' });
    expect(value.refundDuePhp).toBe(5000);
  });

  it('does not count a security deposit that has not been paid yet', () => {
    const value = outcome({ booking: { guestBalancePaid: 0 } });

    expect(value.amountPaidPhp).toBe(2000);
    expect(value.securityDepositHeldPhp).toBe(0);
    expect(value.refundablePaidPhp).toBe(2000);
    expect(value.refundDuePhp).toBe(2000);
  });

  it('lets a host override the refund, clamped to what was paid', () => {
    const value = outcome({ overrideRefundPhp: 1000 });

    expect(value.overrideApplied).toBe(true);
    expect(value.appliedRule).toMatchObject({ kind: 'override' });
    expect(value.refundDuePhp).toBe(1000);
    expect(value.retainedPhp).toBe(4000);
    expect(value.warnings).toContain('This refund is lower than the policy.');
  });

  it('warns and clamps when the override is above what was paid', () => {
    const value = outcome({ overrideRefundPhp: 99_000 });

    expect(value.refundDuePhp).toBe(5000);
    expect(value.warnings).toContain('Refund cannot be more than the amount already paid.');
  });

  it('rounds the refund to whole pesos', () => {
    const policy = buildCancellationPreset('custom', {
      tiers: [{ daysBefore: 7, refundPercent: 33 }],
    });
    const value = outcome({
      policy,
      cancelledAt: '2026-11-10T00:00:00.000Z',
      booking: { downPayment: 1001, guestBalancePaid: 0, securityDeposit: 0 },
    });

    // 33% of ₱1,001 is ₱330.33, paid out as ₱330.
    expect(value.refundDuePhp).toBe(330);
    expect(value.retainedPhp).toBe(671);
  });

  it('reports the next deadline after the cancellation', () => {
    const policy = buildCancellationPreset('firm');
    const value = outcome({ policy, cancelledAt: '2026-11-01T00:00:00.000Z' });

    expect(value.nextDeadline?.daysBefore).toBe(14);
  });

  it('reports the money lines in a stable order', () => {
    const value = outcome();

    expect(value.lines.map((line) => line.kind)).toEqual([
      'paid_for_stay',
      'security_deposit',
      'paid',
      'refund',
    ]);
    expect(value.lines.find((line) => line.kind === 'refund')?.amountPhp).toBe(5000);
  });

  it('survives a missing check-in date without inventing an instant', () => {
    const value = outcome({ booking: { checkInDate: '' } });

    expect(value.checkInInstantIso).toBe('');
    expect(value.deadlines).toEqual([]);
    expect(value.mode).toBe('computed');
  });
});

describe('cancellationMoneyInputFromBooking', () => {
  it('maps a guest_submissions row, including numeric strings', () => {
    expect(
      cancellationMoneyInputFromBooking({
        booking_rate: '6000',
        down_payment: 2000,
        guest_balance_paid_amount: '',
        security_deposit: null,
        has_pets: 'true',
        guest_additional_fee: 250,
        applied_voucher_discount_php: 100,
        booking_source: 'direct',
        external_source: undefined,
        check_in_date: CHECK_IN,
      })
    ).toEqual({
      bookingRate: 6000,
      downPayment: 2000,
      guestBalancePaid: null,
      securityDeposit: null,
      petFee: null,
      hasPets: true,
      additionalFee: 250,
      voucherDiscount: 100,
      bookingSource: 'direct',
      externalSource: null,
      checkInDate: CHECK_IN,
    });
  });

  it('treats an empty row as empty money and no dates', () => {
    const value = cancellationMoneyInputFromBooking({});

    expect(value).toMatchObject({
      bookingRate: null,
      hasPets: false,
      bookingSource: null,
      checkInDate: '',
    });
  });
});
