import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  formatOpsAlertMessage,
  formatStormMessage,
  isStorm,
  opsAlertsEnabled,
  reNotifyIntervalMs,
  scrubOpsAlertText,
  shouldNotify,
  type OpsAlertRow,
} from './opsAlert.ts';
import { signOpsAlertBody, verifyOpsAlertSignature } from './opsAlertIngest.ts';

function row(overrides: Partial<OpsAlertRow> = {}): OpsAlertRow {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    alert_key: 'edge:submit-form:5xx',
    tier: 'p0',
    source: 'edge',
    title: 'submit-form failing',
    summary: 'POST 500',
    links: {},
    context: {},
    status: 'open',
    first_seen_at: '2026-11-20T06:00:00.000Z',
    last_seen_at: '2026-11-20T06:10:00.000Z',
    occurrences: 3,
    last_notified_at: null,
    notify_count: 0,
    ...overrides,
  };
}

Deno.test('re-notify intervals come from the tier', () => {
  assertEquals(reNotifyIntervalMs('p0'), 15 * 60 * 1000);
  assertEquals(reNotifyIntervalMs('p1'), 60 * 60 * 1000);
  assertEquals(reNotifyIntervalMs('p2'), 6 * 60 * 60 * 1000);
  assertEquals(reNotifyIntervalMs('p3'), 24 * 60 * 60 * 1000);
});

Deno.test('shouldNotify: new alerts notify, existing ones wait for the tier interval', () => {
  const now = new Date('2026-11-20T06:20:00.000Z');
  assert(shouldNotify(null, 'p0', now));

  const oneMinuteAgo = { last_notified_at: '2026-11-20T06:19:00.000Z' };
  assertEquals(shouldNotify(oneMinuteAgo, 'p0', now), false);

  const sixteenMinutesAgo = { last_notified_at: '2026-11-20T06:04:00.000Z' };
  assert(shouldNotify(sixteenMinutesAgo, 'p0', now));

  const thirtyMinutesAgo = { last_notified_at: '2026-11-20T05:50:00.000Z' };
  assertEquals(shouldNotify(thirtyMinutesAgo, 'p1', now), false);

  assert(shouldNotify(thirtyMinutesAgo, 'drill', now));
});

Deno.test('isStorm: more than ten notifications in five minutes collapses', () => {
  const now = new Date('2026-11-20T06:10:00.000Z');
  const recent = Array.from({ length: 10 }, (_, index) =>
    new Date(now.getTime() - index * 1000).toISOString()
  );
  assertEquals(isStorm(recent, now), false);
  assert(isStorm([...recent, new Date(now.getTime() - 2000).toISOString()], now));
  assertEquals(isStorm([new Date(now.getTime() - 6 * 60 * 1000).toISOString()], now), false);
  assertEquals(isStorm([null, undefined, 'not-a-date'], now), false);
});

Deno.test('formatOpsAlertMessage: tier marker, escaped text, Manila times, no raw HTML', () => {
  const message = formatOpsAlertMessage(
    row({
      title: 'submit-form <script>alert(1)</script>',
      links: { Sentry: 'https://sentry.io/x', Bad: 'javascript:alert(1)' },
    })
  );
  assert(message.includes('🔴 P0'));
  assert(!message.includes('<script>'));
  assert(message.includes('&lt;script&gt;'));
  assert(message.includes('https://sentry.io/x'));
  assert(!message.includes('javascript:'));
  assert(message.includes('Manila'));
  assert(message.includes('x3'));
});

Deno.test('formatStormMessage lists the top five titles', () => {
  const rows = Array.from({ length: 7 }, (_, index) => row({ title: `alert ${index}` }));
  const message = formatStormMessage(rows);
  assert(message.includes('Alert storm: 7 alerts'));
  assert(message.includes('alert 4'));
  assert(!message.includes('alert 5'));
});

Deno.test('scrubOpsAlertText strips control characters and truncates', () => {
  assertEquals(scrubOpsAlertText('a\u0000b\nc'), 'a b c');
  assertEquals(scrubOpsAlertText('x'.repeat(400), 10), `${'x'.repeat(9)}…`);
});

Deno.test('opsAlertsEnabled: explicit flag, a configured channel + production, or force', () => {
  assertEquals(
    opsAlertsEnabled(() => undefined),
    false
  );
  // A production env alone is not enough: a channel must be configured.
  assertEquals(
    opsAlertsEnabled((key) => (key === 'ENVIRONMENT' ? 'production' : undefined)),
    false
  );
  assertEquals(
    opsAlertsEnabled((key) =>
      key === 'ENVIRONMENT' ? 'production' : key === 'TELEGRAM_OPS_CHAT_ID' ? '123' : undefined
    ),
    true
  );
  assertEquals(
    opsAlertsEnabled((key) =>
      key === 'OPS_ALERTS_ENABLED'
        ? 'true'
        : key === 'OPS_ALERT_EMAILS'
          ? 'ops@example.com'
          : undefined
    ),
    true
  );
  assertEquals(
    opsAlertsEnabled((key) => (key === 'OPS_ALERTS_FORCE_SEND' ? 'true' : undefined)),
    true
  );
});

Deno.test('ops-alert ingest HMAC accepts the exact body and rejects tampering', async () => {
  const secret = 'test-secret';
  const body = JSON.stringify({ key: 'edge:x:5xx', title: 'x' });
  const signature = await signOpsAlertBody(body, secret);

  assert(await verifyOpsAlertSignature(body, signature, secret));
  assert(await verifyOpsAlertSignature(body, signature.replace('sha256=', ''), secret));
  assertEquals(await verifyOpsAlertSignature(`${body} `, signature, secret), false);
  assertEquals(await verifyOpsAlertSignature(body, signature, 'other-secret'), false);
  assertEquals(await verifyOpsAlertSignature(body, null, secret), false);
  assertEquals(await verifyOpsAlertSignature(body, 'sha256=zz', secret), false);
  assertEquals(await verifyOpsAlertSignature(body, signature, undefined), false);
});
