import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { checkAddFeed, type ExistingFeedForAdd } from './calendarFeedAdd.ts';

const ORG = '11111111-1111-4111-8111-111111111111';
const OPEN = { enabled: 'agoda,booking_com' };
const AIRBNB_URL = 'https://www.airbnb.com/calendar/ical/123.ics?s=abc';
const AGODA_URL = 'https://ycs.agoda.com/ical/abc.ics';
const BCOM_URL = 'https://ical.booking.com/v1/export?t=abc';

function check(over: Partial<Parameters<typeof checkAddFeed>[0]> = {}) {
  return checkAddFeed({
    provider: 'airbnb',
    organizationId: ORG,
    rawUrl: AIRBNB_URL,
    existing: [],
    env: {},
    ...over,
  });
}

Deno.test('addFeed: Airbnb is always allowed and defaults when no provider is sent', () => {
  assertEquals(check().ok, true);
  const r = check({ provider: undefined });
  assertEquals(r.ok && r.provider, 'airbnb');
});

Deno.test('addFeed: Agoda and Booking.com are refused until rolled out', () => {
  for (const [provider, rawUrl] of [
    ['agoda', AGODA_URL],
    ['booking_com', BCOM_URL],
  ]) {
    assertEquals(check({ provider, rawUrl }), { ok: false, error: 'That calendar is not available yet' });
    assertEquals(check({ provider, rawUrl, env: OPEN }).ok, true, provider);
  }
});

Deno.test('addFeed: the beta org list limits who may connect', () => {
  const env = { enabled: 'agoda', betaOrgIds: ORG };
  assertEquals(check({ provider: 'agoda', rawUrl: AGODA_URL, env }).ok, true);
  assertEquals(
    check({ provider: 'agoda', rawUrl: AGODA_URL, env, organizationId: 'other-org' }).ok,
    false
  );
});

Deno.test('addFeed: unsupported or malformed providers are refused, never guessed', () => {
  for (const provider of ['vrbo', 'other', 'expedia', 'AIRBNB', 42, {}, '__proto__']) {
    const r = check({ provider, env: { enabled: 'vrbo,other,expedia' } });
    assertEquals(r, { ok: false, error: 'That calendar is not available yet' }, String(provider));
  }
});

Deno.test('addFeed: a link from the wrong channel is refused with that channel named', () => {
  const r = check({ provider: 'agoda', rawUrl: AIRBNB_URL, env: OPEN });
  assertEquals(r.ok, false);
  assertEquals(!r.ok && r.error.includes('Agoda'), true);
  assertEquals(check({ provider: 'booking_com', rawUrl: AGODA_URL, env: OPEN }).ok, false);
});

Deno.test('addFeed: lookalike hosts and unsafe URLs are refused', () => {
  const bad = [
    'https://booking.com.evil.io/v1/export?t=a',
    'https://evilbooking.com/v1/export?t=a',
    'http://ical.booking.com/v1/export?t=a',
    'https://user:pw@ical.booking.com/v1/export?t=a',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/x.ics',
    'https://10.0.0.5/x.ics',
    'not a url',
    '',
    '   ',
  ];
  for (const rawUrl of bad) {
    assertEquals(check({ provider: 'booking_com', rawUrl, env: OPEN }).ok, false, rawUrl);
  }
});

Deno.test('addFeed: webcal links are accepted and stored as https', () => {
  const r = check({ provider: 'booking_com', rawUrl: 'webcal://ical.booking.com/v1/export?t=abc', env: OPEN });
  assertEquals(r.ok && r.icsUrl.startsWith('https://ical.booking.com/'), true);
});

Deno.test('addFeed: the 6 active feed cap counts only active feeds', () => {
  const active = (n: number): ExistingFeedForAdd[] =>
    Array.from({ length: n }, (_, i) => ({ isActive: true, url: `https://example.com/${i}.ics` }));
  assertEquals(check({ existing: active(5) }).ok, true);
  const full = check({ existing: active(6) });
  assertEquals(full, { ok: false, error: 'This listing already has 6 calendars connected.' });
  const withInactive = [...active(5), { isActive: false, url: 'https://example.com/x.ics' }];
  assertEquals(check({ existing: withInactive }).ok, true);
});

Deno.test('addFeed: the same link twice is refused, ignoring case and scheme', () => {
  const existing = [{ isActive: true, url: BCOM_URL }];
  const dup = check({ provider: 'booking_com', rawUrl: BCOM_URL, existing, env: OPEN });
  assertEquals(dup, { ok: false, error: 'This calendar is already connected' });
  const webcal = check({
    provider: 'booking_com',
    rawUrl: 'webcal://ical.booking.com/v1/export?t=abc',
    existing,
    env: OPEN,
  });
  assertEquals(webcal.ok, false);
  // An unreadable stored URL never blocks a new connection.
  assertEquals(
    check({ provider: 'booking_com', rawUrl: BCOM_URL, existing: [{ isActive: true, url: null }], env: OPEN }).ok,
    true
  );
});

Deno.test('addFeed: an inactive feed with the same link still counts as a duplicate', () => {
  const r = check({ existing: [{ isActive: false, url: AIRBNB_URL }] });
  assertEquals(r.ok, false);
});
