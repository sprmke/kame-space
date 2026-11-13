import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { rangeBounds, summarizeMarketingResults } from './marketingResults.ts';

Deno.test('summarize: counts visits and requests by channel', () => {
  const result = summarizeMarketingResults(
    [
      { utm_source: 'facebook_page' },
      { utm_source: 'facebook_page' },
      { utm_source: 'instagram' },
    ],
    [
      { attribution: { utmSource: 'facebook_page' } },
      { attribution: { utmSource: 'instagram' } },
    ]
  );
  assertEquals(result.trackedVisits, 3);
  assertEquals(result.attributedRequests, 2);
  assertEquals(result.channels[0], { channel: 'facebook_page', visits: 2, requests: 1 });
});

Deno.test('summarize: an unknown channel is grouped as other', () => {
  const result = summarizeMarketingResults(
    [{ utm_source: null }, { utm_source: '   ' }],
    [{ attribution: null }]
  );
  assertEquals(result.channels[0].channel, 'other');
  assertEquals(result.channels[0].visits, 2);
  assertEquals(result.channels[0].requests, 1);
});

Deno.test('summarize: empty input yields zeros and no channels', () => {
  assertEquals(summarizeMarketingResults([], []), {
    trackedVisits: 0,
    attributedRequests: 0,
    channels: [],
  });
});

Deno.test('summarize: caps the channel list to the busiest eight', () => {
  const visits = Array.from({ length: 12 }, (_, index) => ({ utm_source: `channel-${index}` }));
  assertEquals(summarizeMarketingResults(visits, []).channels.length, 8);
});

Deno.test('rangeBounds: whole Manila days, inclusive', () => {
  assertEquals(rangeBounds('2026-11-01', '2026-11-30'), {
    fromIso: '2026-11-01T00:00:00+08:00',
    toIso: '2026-11-30T23:59:59+08:00',
  });
});
