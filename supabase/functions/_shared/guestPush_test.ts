import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { guestPushCheckInLabel, guestPushCopyForStatus } from './guestPush.ts';
import { notificationTypeGroup } from './notificationPreferences.ts';

Deno.test('guestPushCopyForStatus - confirmed uses the guest vocabulary', () => {
  const copy = guestPushCopyForStatus({
    status: 'PENDING_DOCUMENTS',
    propertyName: 'Solea Mactan',
    checkInLabel: 'Dec 10, 2026',
  });
  assertEquals(copy?.title, 'Solea Mactan: Confirmed');
  assertEquals(copy?.body, 'Check-in Dec 10, 2026. Open your trip for the details.');
});

Deno.test('guestPushCopyForStatus - ready for check-in points at the arrival steps', () => {
  const copy = guestPushCopyForStatus({
    status: 'READY_FOR_CHECKIN',
    propertyName: 'Solea Mactan',
    checkInLabel: 'Dec 10, 2026',
  });
  assertEquals(copy?.title, 'Solea Mactan: Ready for check-in');
  assertEquals(copy?.body, 'Check-in Dec 10, 2026. Your arrival steps are on your trip page.');
});

Deno.test('guestPushCopyForStatus - only the two awaited milestones push', () => {
  for (const status of [
    'PENDING_REVIEW',
    'READY_FOR_CHECKOUT',
    'PENDING_SD_REFUND',
    'COMPLETED',
    'CANCELLED',
    '',
  ]) {
    assertEquals(
      guestPushCopyForStatus({ status, propertyName: 'Solea Mactan', checkInLabel: 'Dec 10' }),
      null,
      `${status || '(empty)'} must not wake a phone`
    );
  }
});

Deno.test('guestPushCopyForStatus - a missing property name still reads', () => {
  const copy = guestPushCopyForStatus({
    status: 'PENDING_DOCUMENTS',
    propertyName: '  ',
    checkInLabel: 'Dec 10, 2026',
  });
  assertEquals(copy?.title, 'Confirmed');
});

Deno.test('guestPushCopyForStatus - types land in the Bookings preference group', () => {
  for (const status of ['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN']) {
    const copy = guestPushCopyForStatus({
      status,
      propertyName: 'Solea Mactan',
      checkInLabel: 'Dec 10',
    });
    assertEquals(notificationTypeGroup(copy!.type), 'bookings');
  }
});

Deno.test('guestPushCheckInLabel - formats a booking date, passes odd values through', () => {
  assertEquals(guestPushCheckInLabel('2026-12-10'), 'Dec 10, 2026');
  assertEquals(guestPushCheckInLabel('2027-01-05'), 'Jan 5, 2027');
  assertEquals(guestPushCheckInLabel('12-10-2026'), '12-10-2026');
  assertEquals(guestPushCheckInLabel(''), '');
});
