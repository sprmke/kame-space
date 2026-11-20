/**
 * PayMongo webhook claim lease (ledger PR-019 / #163) against the local Postgres.
 *
 * The old dedupe inserted the row before processing and never removed it, so a failed or
 * crashed handler made every provider retry a duplicate. These tests pin the replacement:
 * complete is a duplicate, a released claim is retryable, and an abandoned claim is taken
 * over after its lease.
 *
 * Run with a local stack up:
 *   bun run test:edge:paymongo-dedupe
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import {
  claimPaymongoEvent,
  completePaymongoEvent,
  releasePaymongoEvent,
} from '../_shared/paymongoEventDedupe.ts';
import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY);
const TAG = `dedupe-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function cleanup() {
  await supabase.from('processed_paymongo_events').delete().like('event_id', `${TAG}%`);
}

Deno.test(
  'paymongo dedupe: claim, duplicate while in flight, duplicate after complete',
  async () => {
    await cleanup();
    try {
      assertEquals(await claimPaymongoEvent(supabase, `${TAG}-1`, 'payment.paid'), 'claimed');
      assertEquals(await claimPaymongoEvent(supabase, `${TAG}-1`, 'payment.paid'), 'duplicate');

      await completePaymongoEvent(supabase, `${TAG}-1`);
      assertEquals(await claimPaymongoEvent(supabase, `${TAG}-1`, 'payment.paid'), 'duplicate');
    } finally {
      await cleanup();
    }
  }
);

Deno.test('paymongo dedupe: a released claim can be retried', async () => {
  await cleanup();
  try {
    assertEquals(await claimPaymongoEvent(supabase, `${TAG}-2`, 'payment.failed'), 'claimed');
    await releasePaymongoEvent(supabase, `${TAG}-2`);
    assertEquals(await claimPaymongoEvent(supabase, `${TAG}-2`, 'payment.failed'), 'claimed');
  } finally {
    await cleanup();
  }
});

Deno.test('paymongo dedupe: an abandoned claim is taken over after the lease', async () => {
  await cleanup();
  try {
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { error } = await supabase.from('processed_paymongo_events').insert({
      event_id: `${TAG}-3`,
      event_type: 'payment.paid',
      processed_at: null,
      created_at: stale,
    });
    assertEquals(error, null);

    assertEquals(await claimPaymongoEvent(supabase, `${TAG}-3`, 'payment.paid'), 'claimed');
    // Takeover resets the lease, so an immediate replay is a duplicate again.
    assertEquals(await claimPaymongoEvent(supabase, `${TAG}-3`, 'payment.paid'), 'duplicate');
  } finally {
    await cleanup();
  }
});

Deno.test('paymongo dedupe: an old completed event stays a duplicate', async () => {
  await cleanup();
  try {
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { error } = await supabase.from('processed_paymongo_events').insert({
      event_id: `${TAG}-4`,
      event_type: 'payment.paid',
      processed_at: stale,
      created_at: stale,
    });
    assertEquals(error, null);

    assertEquals(await claimPaymongoEvent(supabase, `${TAG}-4`, 'payment.paid'), 'duplicate');
  } finally {
    await cleanup();
  }
});
