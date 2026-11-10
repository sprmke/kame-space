import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildParkingLedgerTotalsByBooking } from './dashboardService.ts';

Deno.test('parking ledger map prefers a paid row over a pending row', () => {
  const map = buildParkingLedgerTotalsByBooking([
    { booking_id: 'b1', status: 'pending', guest_charge_total: 700, host_net_total: 630 },
    { booking_id: 'b1', status: 'paid', guest_charge_total: 700, host_net_total: 630 },
  ]);
  assertEquals(map.get('b1')?.status, 'paid');
  assertEquals(map.get('b1')?.hostNetTotal, 630);
  assertEquals(map.get('b1')?.guestChargeTotal, 700);
});

Deno.test('parking ledger map ignores expired and cancelled rows', () => {
  const map = buildParkingLedgerTotalsByBooking([
    { booking_id: 'b1', status: 'expired', guest_charge_total: 700, host_net_total: 630 },
    { booking_id: 'b2', status: 'cancelled', guest_charge_total: 700, host_net_total: 630 },
  ]);
  assertEquals(map.size, 0);
});

Deno.test('parking ledger map keeps one total per booking and ignores blank ids', () => {
  const map = buildParkingLedgerTotalsByBooking([
    { booking_id: '', status: 'paid', guest_charge_total: 700, host_net_total: 630 },
    { booking_id: 'b1', status: 'paid', guest_charge_total: 1200, host_net_total: 1080 },
    { booking_id: 'b1', status: 'pending', guest_charge_total: 900, host_net_total: 810 },
  ]);
  assertEquals(map.size, 1);
  assertEquals(map.get('b1')?.hostNetTotal, 1080);
});
