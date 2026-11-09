import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  PUBLISH_BACKOFF_MINUTES,
  decidePublishAction,
  isDue,
  nextAttemptIso,
} from './marketingPublishScheduler.ts';

const healthy = { claim: 'ok' as const, attempts: 0, connectionHealthy: true };

Deno.test('decide: a healthy first attempt publishes', () => {
  assertEquals(decidePublishAction(healthy), { kind: 'publish' });
});

Deno.test('decide: a broken claim holds, and wins over everything else', () => {
  assertEquals(
    decidePublishAction({ ...healthy, claim: 'broken', claimReason: 'Nov 14 got booked' }),
    { kind: 'hold', reason: 'Nov 14 got booked' }
  );
  assertEquals(
    decidePublishAction({ ...healthy, claim: 'broken', attempts: 3, connectionHealthy: false }).kind,
    'hold'
  );
});

Deno.test('decide: an unhealthy connection fails instead of retrying forever', () => {
  assertEquals(decidePublishAction({ ...healthy, connectionHealthy: false }).kind, 'fail');
});

Deno.test('decide: retries climb the backoff ladder then give up', () => {
  const first = decidePublishAction({ ...healthy, attempts: 1 });
  assertEquals(first, { kind: 'retry', nextAttemptInMinutes: PUBLISH_BACKOFF_MINUTES[0] });
  const second = decidePublishAction({ ...healthy, attempts: 2 });
  assertEquals(second, { kind: 'retry', nextAttemptInMinutes: PUBLISH_BACKOFF_MINUTES[1] });
  const third = decidePublishAction({ ...healthy, attempts: 3 });
  assertEquals(third, { kind: 'retry', nextAttemptInMinutes: PUBLISH_BACKOFF_MINUTES[2] });
  assertEquals(decidePublishAction({ ...healthy, attempts: 4 }).kind, 'fail');
});

Deno.test('nextAttemptIso: adds the backoff to now', () => {
  assertEquals(
    nextAttemptIso(new Date('2026-11-09T10:00:00.000Z'), 5),
    '2026-11-09T10:05:00.000Z'
  );
});

Deno.test('isDue: only scheduled rows past their window', () => {
  const now = '2026-11-09T10:00:00.000Z';
  assertEquals(
    isDue({ status: 'scheduled', scheduledAt: '2026-11-09T09:00:00.000Z', nextAttemptAt: null, nowIso: now }),
    true
  );
  assertEquals(
    isDue({ status: 'scheduled', scheduledAt: '2026-11-09T11:00:00.000Z', nextAttemptAt: null, nowIso: now }),
    false
  );
  assertEquals(
    isDue({ status: 'scheduled', scheduledAt: '2026-11-09T09:00:00.000Z', nextAttemptAt: '2026-11-09T10:30:00.000Z', nowIso: now }),
    false
  );
  assertEquals(
    isDue({ status: 'published', scheduledAt: '2026-11-09T09:00:00.000Z', nextAttemptAt: null, nowIso: now }),
    false
  );
});
