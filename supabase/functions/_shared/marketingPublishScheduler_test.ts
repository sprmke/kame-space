import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  PUBLISH_BACKOFF_MINUTES,
  decidePublishAction,
  isDue,
  isItemDueForReminder,
  nextAttemptIso,
  publishTypeFor,
  reminderLeadMinutes,
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

Deno.test('reminderLeadMinutes: defaults to 30 and clamps to a sane range', () => {
  assertEquals(reminderLeadMinutes(undefined), 30);
  assertEquals(reminderLeadMinutes('nope'), 30);
  assertEquals(reminderLeadMinutes(0), 5);
  assertEquals(reminderLeadMinutes(10_000), 24 * 60);
  assertEquals(reminderLeadMinutes(45), 45);
});

Deno.test('isItemDueForReminder: only open items inside the lead window', () => {
  const now = '2026-11-09T10:00:00.000Z';
  assertEquals(
    isItemDueForReminder({
      status: 'planned',
      scheduledFor: '2026-11-09T10:20:00.000Z',
      nowIso: now,
      leadMinutes: 30,
    }),
    true
  );
  assertEquals(
    isItemDueForReminder({
      status: 'planned',
      scheduledFor: '2026-11-09T11:00:00.000Z',
      nowIso: now,
      leadMinutes: 30,
    }),
    false
  );
  assertEquals(
    isItemDueForReminder({
      status: 'published',
      scheduledFor: '2026-11-09T10:10:00.000Z',
      nowIso: now,
      leadMinutes: 30,
    }),
    false
  );
  assertEquals(
    isItemDueForReminder({
      status: 'planned',
      scheduledFor: '2026-11-09T09:50:00.000Z',
      nowIso: now,
      leadMinutes: 30,
    }),
    false
  );
});

Deno.test('publishTypeFor: maps platform and post type onto the publish union', () => {
  assertEquals(publishTypeFor({ platform: 'facebook', publish_type: 'post' }), 'facebook_post');
  assertEquals(publishTypeFor({ platform: 'facebook', publish_type: 'story' }), 'facebook_post');
  assertEquals(publishTypeFor({ platform: 'instagram', publish_type: 'post' }), 'instagram_post');
  assertEquals(publishTypeFor({ platform: 'instagram', publish_type: 'story' }), 'instagram_story');
  assertEquals(publishTypeFor({ platform: 'instagram', publish_type: 'reel' }), 'instagram_reel');
});
