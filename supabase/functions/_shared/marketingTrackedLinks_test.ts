import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildTrackedPath,
  buildTrackedUrl,
  campaignCode,
  formatShortCode,
  isValidShortCode,
  sanitizeAttribution,
  shortCodeFromCampaign,
  stripTracking,
} from './marketingTrackedLinks.ts';

const bytes = (value: number[]): Uint8Array => new Uint8Array(value);

Deno.test('formatShortCode: deterministic for the same bytes, 8 chars', () => {
  const code = formatShortCode(bytes([1, 2, 3, 4, 5, 6, 7, 8]));
  assertEquals(code, formatShortCode(bytes([1, 2, 3, 4, 5, 6, 7, 8])));
  assertEquals(code.length, 8);
  assert(isValidShortCode(code));
});

Deno.test('formatShortCode: different bytes give different codes', () => {
  assert(
    formatShortCode(bytes([9, 8, 7, 6, 5, 4, 3, 2])) !==
      formatShortCode(bytes([1, 2, 3, 4, 5, 6, 7, 8]))
  );
});

Deno.test('isValidShortCode: rejects wrong length and ambiguous characters', () => {
  assertEquals(isValidShortCode('abcd2345'), true);
  assertEquals(isValidShortCode('abcd234'), false);
  assertEquals(isValidShortCode('abcd2340'), false);
  assertEquals(isValidShortCode('abcd234o'), false);
  assertEquals(isValidShortCode(42), false);
});

Deno.test('campaignCode round-trips through shortCodeFromCampaign', () => {
  const code = formatShortCode(bytes([3, 3, 3, 3, 3, 3, 3, 3]));
  assertEquals(shortCodeFromCampaign(campaignCode(code)), code);
  assertEquals(shortCodeFromCampaign('spring-sale'), null);
  assertEquals(shortCodeFromCampaign('ks-nope'), null);
  assertEquals(shortCodeFromCampaign(null), null);
});

Deno.test('buildTrackedUrl: sets all three params and never duplicates them', () => {
  const once = buildTrackedUrl('https://example.com/p/demo-stay', {
    channel: 'instagram',
    shortCode: 'abcd2345',
  });
  const twice = buildTrackedUrl(once, { channel: 'facebook_page', shortCode: 'abcd2345' });
  assertEquals(new URL(twice).searchParams.getAll('utm_source'), ['facebook_page']);
  assertEquals(new URL(twice).searchParams.get('utm_campaign'), 'ks-abcd2345');
  assertEquals(new URL(twice).searchParams.get('utm_medium'), 'social');
});

Deno.test('stripTracking: removes only our params and keeps the rest', () => {
  const stripped = stripTracking(
    'https://example.com/p/demo-stay?utm_source=instagram&utm_medium=social&utm_campaign=ks-abcd2345&guests=4'
  );
  assertEquals(stripped, 'https://example.com/p/demo-stay?guests=4');
});

Deno.test('sanitizeAttribution: keeps an allow-listed shape and extracts the item code', () => {
  assertEquals(
    sanitizeAttribution({
      utmSource: 'instagram',
      utmMedium: 'social',
      utmCampaign: 'ks-abcd2345',
      landingAt: '/p/demo-stay',
      email: 'guest@example.com',
    }),
    {
      utmSource: 'instagram',
      utmMedium: 'social',
      utmCampaign: 'ks-abcd2345',
      planItemCode: 'abcd2345',
      landingAt: '/p/demo-stay',
    }
  );
});

Deno.test('sanitizeAttribution: drops an absolute landing URL and empty values', () => {
  assertEquals(
    sanitizeAttribution({ landingAt: 'https://evil.example/', utmSource: '  ' }),
    null
  );
  assertEquals(sanitizeAttribution({ utmSource: 'facebook_page' })?.landingAt, null);
  assertEquals(sanitizeAttribution('nope'), null);
});

Deno.test('sanitizeAttribution: caps value length', () => {
  const long = 'x'.repeat(300);
  assertEquals(sanitizeAttribution({ utmSource: long })?.utmSource?.length, 120);
});

Deno.test('buildTrackedPath: relative path keeps a leading slash and encodes the code', () => {
  assertEquals(
    buildTrackedPath('/properties/demo-stay', { channel: 'facebook_page', shortCode: 'abcd2345' }),
    '/properties/demo-stay?utm_source=facebook_page&utm_medium=social&utm_campaign=ks-abcd2345'
  );
  assertEquals(
    buildTrackedPath('properties/demo-stay', { channel: 'instagram', shortCode: 'abcd2345' }),
    '/properties/demo-stay?utm_source=instagram&utm_medium=social&utm_campaign=ks-abcd2345'
  );
});
