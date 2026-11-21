import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * `databaseService.ts` builds its Supabase client in a static initializer, so a module
 * graph that touches it throws at import time without a URL. These are placeholders:
 * nothing in this file connects, every assertion is pure.
 */
Deno.env.set('SUPABASE_URL', Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'test-key');
Deno.env.set('SUPABASE_ANON_KEY', Deno.env.get('SUPABASE_ANON_KEY') ?? 'test-anon-key');

const {
  CancellationNotAllowedError,
  CANCELLATION_REASON_CODES,
  PolicyChangedError,
  assertHostRefundFloor,
  computeOutcomeForBooking,
  guestMustRequestCancellation,
  isCancellationReasonCode,
  isGuestCancellable,
  isHostCancellable,
  resolveHostCancellationInitiator,
  shouldNotifyGuestOnCancellation,
} = await import('../_shared/cancellationService.ts');
const { buildCancellationPreset } = await import('../_shared/cancellationPolicy.ts');

/*
 * Money and state rules for cancellation. Every assertion here can move money, so a
 * regression is a refund paid twice or a booking cancelled when it should not be.
 */

const CHECK_IN = '2026-11-20';
const CHECK_IN_TIME = '14:00';

function booking(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    booking_rate: 6000,
    down_payment: 2000,
    guest_balance_paid_amount: 3000,
    security_deposit: 1500,
    check_in_date: CHECK_IN,
    has_pets: false,
    ...overrides,
  };
}

Deno.test('isCancellationReasonCode accepts the catalog and rejects anything else', () => {
  for (const code of CANCELLATION_REASON_CODES) {
    assertEquals(isCancellationReasonCode(code), true);
  }

  assertEquals(isCancellationReasonCode('because'), false);
  assertEquals(isCancellationReasonCode('CHANGE_OF_PLANS'), false);
  assertEquals(isCancellationReasonCode(null), false);
  assertEquals(isCancellationReasonCode(7), false);
});

Deno.test('isGuestCancellable only allows pre-check-in guest statuses', () => {
  const before = new Date('2026-11-18T00:00:00.000Z');

  assertEquals(isGuestCancellable('PENDING_REVIEW', CHECK_IN, CHECK_IN_TIME, before), true);
  assertEquals(isGuestCancellable('READY_FOR_CHECKIN', CHECK_IN, CHECK_IN_TIME, before), true);
  assertEquals(isGuestCancellable('READY_FOR_CHECKOUT', CHECK_IN, CHECK_IN_TIME, before), false);
  assertEquals(isGuestCancellable('COMPLETED', CHECK_IN, CHECK_IN_TIME, before), false);
  assertEquals(isGuestCancellable('CANCELLED', CHECK_IN, CHECK_IN_TIME, before), false);
});

Deno.test('isGuestCancellable stops at the Manila check-in instant, not UTC midnight', () => {
  // 14:00 Manila on 2026-11-20 is 06:00Z.
  const oneSecondBefore = new Date('2026-11-20T05:59:59.000Z');
  const exactly = new Date('2026-11-20T06:00:00.000Z');

  assertEquals(
    isGuestCancellable('PENDING_REVIEW', CHECK_IN, CHECK_IN_TIME, oneSecondBefore),
    true
  );
  assertEquals(isGuestCancellable('PENDING_REVIEW', CHECK_IN, CHECK_IN_TIME, exactly), false);
});

Deno.test('isGuestCancellable refuses an unparseable check-in date', () => {
  assertEquals(
    isGuestCancellable('PENDING_REVIEW', '', CHECK_IN_TIME, new Date('2026-11-01T00:00:00Z')),
    false
  );
});

Deno.test('isHostCancellable includes checkout and the SD refund stage', () => {
  assertEquals(isHostCancellable('READY_FOR_CHECKOUT'), true);
  assertEquals(isHostCancellable('PENDING_SD_REFUND'), true);
  assertEquals(isHostCancellable('COMPLETED'), false);
  assertEquals(isHostCancellable(undefined), false);
});

Deno.test('guestMustRequestCancellation turns on once the balance is settled', () => {
  assertEquals(guestMustRequestCancellation({ guest_balance_paid_amount: 0 }), false);
  assertEquals(guestMustRequestCancellation({ guest_balance_paid_amount: '0' }), false);
  assertEquals(guestMustRequestCancellation({}), false);
  assertEquals(guestMustRequestCancellation({ guest_balance_paid_amount: 1500 }), true);
  assertEquals(guestMustRequestCancellation({ guest_balance_paid_amount: '1500.00' }), true);
});

Deno.test('computeOutcomeForBooking refunds the matching policy tier and the deposit', () => {
  const outcome = computeOutcomeForBooking({
    booking: booking(),
    policy: buildCancellationPreset('flexible'),
    checkInTime: CHECK_IN_TIME,
    initiator: 'guest',
    cancelledAt: '2026-11-18T00:00:00.000Z',
  });

  assertEquals(outcome.mode, 'computed');
  assertEquals(outcome.refundPercent, 100);
  assertEquals(outcome.amountPaidPhp, 5000);
  assertEquals(outcome.refundablePaidPhp, 3500);
  assertEquals(outcome.securityDepositHeldPhp, 1500);
  assertEquals(outcome.refundDuePhp, 5000);
  assertEquals(outcome.retainedPhp, 0);
});

Deno.test('computeOutcomeForBooking refunds everything when the host cancels', () => {
  const outcome = computeOutcomeForBooking({
    booking: booking(),
    policy: buildCancellationPreset('non_refundable'),
    checkInTime: CHECK_IN_TIME,
    initiator: 'host',
    cancelledAt: '2026-11-01T00:00:00.000Z',
  });

  assertEquals(outcome.appliedRule?.kind, 'host');
  assertEquals(outcome.refundDuePhp, 5000);
});

Deno.test('computeOutcomeForBooking hands an external channel booking back to the channel', () => {
  const outcome = computeOutcomeForBooking({
    booking: booking({ external_source: 'airbnb' }),
    policy: buildCancellationPreset('flexible'),
    checkInTime: CHECK_IN_TIME,
    initiator: 'ota',
    cancelledAt: '2026-11-18T00:00:00.000Z',
  });

  assertEquals(outcome.mode, 'external');
  assertEquals(outcome.refundDuePhp, 0);
});

Deno.test('computeOutcomeForBooking clamps a host override to what was paid', () => {
  const outcome = computeOutcomeForBooking({
    booking: booking(),
    policy: buildCancellationPreset('flexible'),
    checkInTime: CHECK_IN_TIME,
    initiator: 'guest',
    cancelledAt: '2026-11-18T00:00:00.000Z',
    overrideRefundPhp: 99_000,
  });

  assertEquals(outcome.overrideApplied, true);
  assertEquals(outcome.refundDuePhp, 5000);
  assertEquals(
    outcome.warnings.includes('Refund cannot be more than the amount already paid.'),
    true
  );
});

Deno.test('computeOutcomeForBooking asks the host to confirm when the policy is unset', () => {
  const outcome = computeOutcomeForBooking({
    booking: booking(),
    policy: null,
    checkInTime: CHECK_IN_TIME,
    initiator: 'guest',
    cancelledAt: '2026-11-18T00:00:00.000Z',
  });

  assertEquals(outcome.mode, 'host_decides');
  assertEquals(outcome.refundPercent, null);
  assertEquals(outcome.refundDuePhp, 0);
});

Deno.test('cancellation errors carry the HTTP status and code the wrapper returns', () => {
  const policyChanged = new PolicyChangedError();
  assertEquals(policyChanged.status, 409);
  assertEquals(policyChanged.code, 'policy_changed');

  const notAllowed = new CancellationNotAllowedError('The stay already started');
  assertEquals(notAllowed.status, 409);
  assertEquals(notAllowed.code, 'not_cancellable');

  const forbidden = new CancellationNotAllowedError('Not your booking', 'forbidden', 403);
  assertEquals(forbidden.status, 403);
  assertEquals(forbidden.code, 'forbidden');

  assertThrows(() => {
    throw policyChanged;
  }, PolicyChangedError);
});

Deno.test('host cancel: a guest label needs an open guest request', () => {
  assertEquals(
    resolveHostCancellationInitiator({ requested: 'guest', hasOpenGuestRequest: true }),
    'guest'
  );
  assertEquals(
    resolveHostCancellationInitiator({ requested: 'guest', hasOpenGuestRequest: false }),
    'host'
  );
  assertEquals(
    resolveHostCancellationInitiator({ requested: 'host', hasOpenGuestRequest: true }),
    'host'
  );
  assertEquals(
    resolveHostCancellationInitiator({ requested: undefined, hasOpenGuestRequest: true }),
    'host'
  );
});

Deno.test('host cancel: the guest is always notified except for duplicate or test cleanup', () => {
  assertEquals(shouldNotifyGuestOnCancellation({ reasonCode: 'host_unavailable' }), true);
  assertEquals(
    shouldNotifyGuestOnCancellation({ reasonCode: 'emergency', requested: false }),
    true
  );
  assertEquals(
    shouldNotifyGuestOnCancellation({ reasonCode: 'duplicate_or_test', requested: false }),
    false
  );
  assertEquals(
    shouldNotifyGuestOnCancellation({ reasonCode: 'duplicate_or_test', requested: true }),
    true
  );
  assertEquals(shouldNotifyGuestOnCancellation({ reasonCode: 'duplicate_or_test' }), true);
});

Deno.test('host cancel: a pre-check-in override cannot go below the full refund', () => {
  const beforeCheckIn = new Date('2026-11-18T00:00:00.000Z');
  const base = {
    initiator: 'host' as const,
    cancelledAt: beforeCheckIn,
    checkInDate: CHECK_IN,
    checkInTime: CHECK_IN_TIME,
  };

  assertThrows(
    () => assertHostRefundFloor({ ...base, baseRefundDuePhp: 5000, overrideRefundPhp: 0 }),
    CancellationNotAllowedError
  );
  assertThrows(
    () => assertHostRefundFloor({ ...base, baseRefundDuePhp: 5000, overrideRefundPhp: 4999.99 }),
    CancellationNotAllowedError
  );

  assertHostRefundFloor({ ...base, baseRefundDuePhp: 5000, overrideRefundPhp: 5000 });
  assertHostRefundFloor({ ...base, baseRefundDuePhp: 5000, overrideRefundPhp: 6000 });
  assertHostRefundFloor({ ...base, baseRefundDuePhp: 5000, overrideRefundPhp: null });
});

Deno.test('host cancel: after check-in a partial override stays allowed', () => {
  assertHostRefundFloor({
    initiator: 'host',
    cancelledAt: new Date('2026-11-21T00:00:00.000Z'),
    checkInDate: CHECK_IN,
    checkInTime: CHECK_IN_TIME,
    baseRefundDuePhp: 0,
    overrideRefundPhp: 1200,
  });
});

Deno.test('host cancel: guest overrides are not subject to the host floor', () => {
  assertHostRefundFloor({
    initiator: 'guest',
    cancelledAt: new Date('2026-11-18T00:00:00.000Z'),
    checkInDate: CHECK_IN,
    checkInTime: CHECK_IN_TIME,
    baseRefundDuePhp: 5000,
    overrideRefundPhp: 0,
  });
});

Deno.test(
  'computeOutcomeForBooking refunds everything when the platform cancels before check-in',
  () => {
    const outcome = computeOutcomeForBooking({
      booking: booking(),
      policy: buildCancellationPreset('non_refundable'),
      checkInTime: CHECK_IN_TIME,
      initiator: 'system',
      cancelledAt: '2026-11-01T00:00:00.000Z',
    });

    assertEquals(outcome.initiator, 'system');
    assertEquals(outcome.appliedRule?.kind, 'host');
    assertEquals(outcome.refundDuePhp, 5000);
    assertEquals(outcome.retainedPhp, 0);
  }
);
