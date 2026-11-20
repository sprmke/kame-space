/**
 * Ops alert dispatcher (ledger PR-027) against the local Postgres.
 *
 * Runs with `OPS_ALERTS_FORCE_SEND=true` and no channel credentials, so the DB state machine
 * is exercised without sending anything. The Telegram/email adapters are covered by the
 * message/HMAC unit tests and the operator fire drill.
 *
 * Run with a local stack up:
 *   bun run test:edge:ops-alerts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

Deno.env.set('OPS_ALERTS_FORCE_SEND', 'true');

const { raiseOpsAlert, resolveOpsAlert } = await import('../_shared/ops/opsAlert.ts');

const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY);
const KEY = `test:ops-alert:${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function cleanup() {
  await supabase.from('ops_alerts').delete().eq('alert_key', KEY);
}

Deno.test(
  'ops alert: first raise notifies and the second aggregates without re-notifying',
  async () => {
    await cleanup();
    try {
      const first = await raiseOpsAlert({
        key: KEY,
        tier: 'p0',
        source: 'probe',
        title: 'Synthetic probe failing',
        summary: 'GET /health 503',
      });
      assertEquals(first.notified, true);

      const second = await raiseOpsAlert({
        key: KEY,
        tier: 'p0',
        source: 'probe',
        title: 'Synthetic probe failing',
        summary: 'GET /health 503',
      });
      assertEquals(second.notified, false);

      const { data } = await supabase
        .from('ops_alerts')
        .select('occurrences, notify_count, status')
        .eq('alert_key', KEY)
        .single();
      assertEquals(data?.occurrences, 2);
      assertEquals(data?.notify_count, 1);
      assertEquals(data?.status, 'open');
    } finally {
      await cleanup();
    }
  }
);

Deno.test('ops alert: re-notifies once the tier interval has passed', async () => {
  await cleanup();
  try {
    await raiseOpsAlert({ key: KEY, tier: 'p1', source: 'job', title: 'Cron stale' });
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('ops_alerts')
      .update({ last_notified_at: twoHoursAgo })
      .eq('alert_key', KEY);

    const again = await raiseOpsAlert({ key: KEY, tier: 'p1', source: 'job', title: 'Cron stale' });
    assertEquals(again.notified, true);
  } finally {
    await cleanup();
  }
});

Deno.test('ops alert: resolve closes the row and a later raise opens a new one', async () => {
  await cleanup();
  try {
    await raiseOpsAlert({ key: KEY, tier: 'p2', source: 'vendor', title: 'Vendor status' });
    await resolveOpsAlert(KEY, 'Recovered');

    const { data: resolved } = await supabase
      .from('ops_alerts')
      .select('status')
      .eq('alert_key', KEY)
      .single();
    assertEquals(resolved?.status, 'resolved');

    const raised = await raiseOpsAlert({
      key: KEY,
      tier: 'p2',
      source: 'vendor',
      title: 'Vendor status',
    });
    assertEquals(raised.notified, true);

    const { count } = await supabase
      .from('ops_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('alert_key', KEY);
    assertEquals(count, 2);
  } finally {
    await cleanup();
  }
});
