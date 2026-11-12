import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  auditMetaAppSubscriptions,
  META_OUTAGE_RECOVERY_HOURS,
  type MetaAppSubscription,
} from './metaInboxWebhookHealth.ts';

const CALLBACK = 'https://abc.supabase.co/functions/v1/meta-inbox-webhook';
const FIELDS = ['messages', 'standby', 'message_edits'];

function subs(overrides: Partial<MetaAppSubscription> = {}): MetaAppSubscription[] {
  return [
    { object: 'page', callbackUrl: CALLBACK, active: true, fields: FIELDS },
    { object: 'instagram', callbackUrl: CALLBACK, active: true, fields: FIELDS },
    ...(overrides.object
      ? [{ object: overrides.object, callbackUrl: CALLBACK, active: true, fields: FIELDS }]
      : []),
  ];
}

const opts = { expectedCallbackUrl: CALLBACK, requiredFields: FIELDS };

Deno.test('auditMetaAppSubscriptions: a correctly configured app has no problems', () => {
  assertEquals(auditMetaAppSubscriptions(subs(), opts), []);
});

Deno.test('auditMetaAppSubscriptions: a missing object is reported', () => {
  const problems = auditMetaAppSubscriptions([subs()[0]!], opts);
  assertEquals(problems.length, 1);
  assertEquals(problems[0]!.object, 'instagram');
  assertEquals(problems[0]!.reason, 'missing');
});

Deno.test('auditMetaAppSubscriptions: a switched-off subscription is reported', () => {
  const problems = auditMetaAppSubscriptions(
    subs().map((row) => ({ ...row, active: row.object === 'page' ? false : row.active })),
    opts
  );
  assertEquals(problems.length, 1);
  assertEquals(problems[0]!.reason, 'inactive');
  assertEquals(problems[0]!.object, 'page');
});

Deno.test('auditMetaAppSubscriptions: a callback pointed at a tunnel is reported', () => {
  const problems = auditMetaAppSubscriptions(
    subs().map((row) => ({
      ...row,
      callbackUrl: row.object === 'instagram' ? 'https://abc.ngrok-free.app/wh' : row.callbackUrl,
    })),
    opts
  );
  assertEquals(problems.length, 1);
  assertEquals(problems[0]!.reason, 'wrong_callback_url');
  assertEquals(problems[0]!.object, 'instagram');
});

Deno.test('auditMetaAppSubscriptions: a trailing slash is not a mismatch', () => {
  assertEquals(
    auditMetaAppSubscriptions(
      subs().map((row) => ({ ...row, callbackUrl: `${CALLBACK}/` })),
      opts
    ),
    []
  );
});

Deno.test('auditMetaAppSubscriptions: missing fields are listed once per object', () => {
  const problems = auditMetaAppSubscriptions(
    subs().map((row) => ({ ...row, fields: ['messages'] })),
    opts
  );
  assertEquals(problems.length, 2);
  assertEquals(problems.every((problem) => problem.reason === 'missing_fields'), true);
  assertEquals(problems[0]!.detail.includes('standby'), true);
});

Deno.test('META_OUTAGE_RECOVERY_HOURS: covers the hour Meta stops delivering', () => {
  // Meta unsubscribes the app after an hour of failed deliveries, so the window has to be
  // wider than that plus the 10-minute reconcile overlap.
  assertEquals(META_OUTAGE_RECOVERY_HOURS >= 24, true);
});
