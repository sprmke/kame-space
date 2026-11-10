/**
 * Guest essentials — reveal gating and per-booking overrides.
 * Run: deno test supabase/functions/_shared/guestEssentials_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildGuestEssentialsDto,
  parseEssentialsOverride,
  resolveEssentialsRevealAt,
  buildGuestEssentialsHtml,
} from './guestEssentials.ts';

const ROW = {
  wifi_name: 'Kame_2604',
  wifi_password: 'sunset-2604',
  door_code: '4821',
  unit_floor: 'Monaco 2604 · 26th floor',
  parking_slot_note: 'Level 2, slot 27',
  emergency_contact_name: 'Ana',
  emergency_contact_phone: '09170000000',
  building_security_phone: '09171111111',
  garbage_schedule: 'Daily 7pm',
  quiet_hours: '10pm to 7am',
  reveal_lead_hours: 24,
};

// Check-in 2026-12-10 14:00 Manila → reveal 2026-12-09 14:00 Manila.
const CHECK_IN_DATE = '2026-12-10';
const CHECK_IN_TIME = '14:00';

Deno.test('resolveEssentialsRevealAt - 24h before the Manila check-in time', () => {
  const at = resolveEssentialsRevealAt(CHECK_IN_DATE, CHECK_IN_TIME, 24);
  assertEquals(at?.toISOString(), '2026-12-09T06:00:00.000Z');
});

Deno.test('resolveEssentialsRevealAt - defaults to 24h and clamps the input', () => {
  assertEquals(
    resolveEssentialsRevealAt(CHECK_IN_DATE, CHECK_IN_TIME, null)?.toISOString(),
    '2026-12-09T06:00:00.000Z'
  );
  // A negative lead reveals at check-in, never earlier; 30 days is the maximum lead.
  assertEquals(
    resolveEssentialsRevealAt(CHECK_IN_DATE, CHECK_IN_TIME, -5)?.toISOString(),
    '2026-12-10T06:00:00.000Z'
  );
  assertEquals(
    resolveEssentialsRevealAt(CHECK_IN_DATE, CHECK_IN_TIME, 99_999)?.toISOString(),
    '2026-11-10T06:00:00.000Z'
  );
});

Deno.test('resolveEssentialsRevealAt - an unreadable check-in date reveals nothing', () => {
  assertEquals(resolveEssentialsRevealAt('', null, 24), null);
  assertEquals(resolveEssentialsRevealAt('not-a-date', null, 24), null);
});

Deno.test('buildGuestEssentialsDto - hides the secrets before the reveal time', () => {
  const dto = buildGuestEssentialsDto({
    row: ROW,
    checkInDate: CHECK_IN_DATE,
    checkInTime: CHECK_IN_TIME,
    now: new Date('2026-12-01T00:00:00.000Z'),
  });
  assertEquals(dto?.wifiPassword, null);
  assertEquals(dto?.doorCode, null);
  assertEquals(dto?.revealAt, '2026-12-09T06:00:00.000Z');
  // The page can still say "a code exists, it unlocks at ..." without the value.
  assertEquals(dto?.hasDoorCode, true);
  // Non-secret fields stay visible so the guest can still plan.
  assertEquals(dto?.wifiName, 'Kame_2604');
  assertEquals(dto?.unitFloor, 'Monaco 2604 · 26th floor');
  assertEquals(dto?.emergencyContactPhone, '09170000000');
});

Deno.test('buildGuestEssentialsDto - reveals the secrets from the reveal time', () => {
  const dto = buildGuestEssentialsDto({
    row: ROW,
    checkInDate: CHECK_IN_DATE,
    checkInTime: CHECK_IN_TIME,
    now: new Date('2026-12-09T06:00:00.000Z'),
  });
  assertEquals(dto?.wifiPassword, 'sunset-2604');
  assertEquals(dto?.doorCode, '4821');
  assertEquals(dto?.revealAt, null);
});

Deno.test('buildGuestEssentialsDto - a per-booking code wins over the property default', () => {
  const dto = buildGuestEssentialsDto({
    row: ROW,
    override: { doorCode: '9911' },
    checkInDate: CHECK_IN_DATE,
    checkInTime: CHECK_IN_TIME,
    now: new Date('2026-12-09T06:00:00.000Z'),
  });
  assertEquals(dto?.doorCode, '9911');
  assertEquals(dto?.wifiName, 'Kame_2604');
});

Deno.test('buildGuestEssentialsDto - an unreadable check-in date never reveals secrets', () => {
  const dto = buildGuestEssentialsDto({
    row: ROW,
    checkInDate: '',
    checkInTime: null,
    now: new Date('2030-01-01T00:00:00.000Z'),
  });
  assertEquals(dto?.wifiPassword, null);
  assertEquals(dto?.doorCode, null);
});

Deno.test('buildGuestEssentialsDto - returns null when the property has nothing filled in', () => {
  assertEquals(
    buildGuestEssentialsDto({
      row: { reveal_lead_hours: 24 },
      checkInDate: CHECK_IN_DATE,
      checkInTime: CHECK_IN_TIME,
      now: new Date('2026-12-01T00:00:00.000Z'),
    }),
    null
  );
});

Deno.test('parseEssentialsOverride - ignores non-string and blank values', () => {
  assertEquals(parseEssentialsOverride({ doorCode: '  9911 ', wifiName: '' }), {
    doorCode: '9911',
  });
  assertEquals(parseEssentialsOverride({ doorCode: 4821 }), {});
  assertEquals(parseEssentialsOverride(null), {});
  assertEquals(parseEssentialsOverride('nope'), {});
  assertEquals(parseEssentialsOverride([1, 2]), {});
});

Deno.test('buildGuestEssentialsDto - reports no door code when the property has none', () => {
  const dto = buildGuestEssentialsDto({
    row: { wifi_name: 'Kame_2604', reveal_lead_hours: 24 },
    checkInDate: CHECK_IN_DATE,
    checkInTime: CHECK_IN_TIME,
    now: new Date('2026-12-01T00:00:00.000Z'),
  });
  assertEquals(dto?.hasDoorCode, false);
});

Deno.test('buildGuestEssentialsHtml - escapes host values', () => {
  const dto = buildGuestEssentialsDto({
    row: {
      wifi_name: 'Kame <2604>',
      wifi_password: 'pw&"1"',
      door_code: '4821',
      reveal_lead_hours: 24,
    },
    checkInDate: CHECK_IN_DATE,
    checkInTime: CHECK_IN_TIME,
    now: new Date('2026-12-09T06:00:00.000Z'),
  });
  const html = buildGuestEssentialsHtml(dto, null) ?? '';
  assertEquals(html.includes('Kame &lt;2604&gt;'), true);
  assertEquals(html.includes('pw&amp;&quot;1&quot;'), true);
  assertEquals(html.includes('Kame <2604>'), false);
});

Deno.test('buildGuestEssentialsHtml - a withheld secret prints the reveal label, not the value', () => {
  const dto = buildGuestEssentialsDto({
    row: { wifi_name: 'Kame', wifi_password: 'secret', door_code: '4821', reveal_lead_hours: 24 },
    checkInDate: CHECK_IN_DATE,
    checkInTime: CHECK_IN_TIME,
    now: new Date('2026-12-01T00:00:00.000Z'),
  });
  const html = buildGuestEssentialsHtml(dto, 'Available Dec 9, 2:00 PM') ?? '';
  assertEquals(html.includes('secret'), false);
  assertEquals(html.includes('4821'), false);
  assertEquals(html.includes('Available Dec 9, 2:00 PM'), true);
});

Deno.test('buildGuestEssentialsHtml - returns null when there is nothing to show', () => {
  assertEquals(buildGuestEssentialsHtml(null, null), null);
});
