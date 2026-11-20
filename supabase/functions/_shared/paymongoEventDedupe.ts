/**
 * PayMongo webhook dedupe with a claim lease (ledger PR-019 / #163).
 *
 * The old handler inserted the dedupe row *before* processing and never removed it, so a
 * transient failure (or a function crash mid-run) left the row behind and every provider
 * retry was answered `{ duplicate: true }` — the payment event was lost.
 *
 * Claim model (`processed_paymongo_events.processed_at`):
 *   - `processed_at IS NULL` = a claim in flight, valid for `CLAIM_LEASE_MS`.
 *   - `processed_at IS NOT NULL` = done, a replay is a duplicate.
 *   - a claim older than the lease was abandoned (crash/timeout) and may be taken over.
 *   - a failed handler releases the claim so the provider's retry can process it.
 *
 * Handler side effects are expected to be idempotent (the orchestrator guards on the
 * transaction's current status), so at-least-once redelivery is the safe failure mode.
 */

export const CLAIM_LEASE_MS = 2 * 60 * 1000;

export type PaymongoClaimResult = 'claimed' | 'duplicate';

type Sb = {
  from: (table: string) => any; // deno-lint-ignore no-explicit-any
};

export async function claimPaymongoEvent(
  supabase: Sb,
  eventId: string,
  eventType: string,
  now: Date = new Date()
): Promise<PaymongoClaimResult> {
  const insert = await supabase
    .from('processed_paymongo_events')
    .insert({ event_id: eventId, event_type: eventType, processed_at: null })
    .select('id')
    .maybeSingle();

  if (!insert.error) return 'claimed';

  // 23505 = the event id already has a row. Anything else falls back to processing so a
  // missing table or a transient insert failure cannot silently drop a payment event.
  if (insert.error.code !== '23505') {
    console.error('[paymongo-dedupe] claim insert failed:', insert.error.message);
    return 'claimed';
  }

  const { data: existing } = await supabase
    .from('processed_paymongo_events')
    .select('id, processed_at, created_at')
    .eq('event_id', eventId)
    .limit(1)
    .maybeSingle();

  // The row disappeared between the insert conflict and the read (a release won the race).
  if (!existing) return 'claimed';

  if (existing.processed_at) return 'duplicate';

  const claimedAt = existing.created_at ? Date.parse(existing.created_at) : Number.NaN;
  const leaseExpired = !Number.isFinite(claimedAt) || now.getTime() - claimedAt > CLAIM_LEASE_MS;
  if (!leaseExpired) return 'duplicate';

  // Take over an abandoned claim. The `.is('processed_at', null)` guard keeps a completed
  // event from being reprocessed if the first handler finished in the meantime.
  const takeover = await supabase
    .from('processed_paymongo_events')
    .update({ event_type: eventType, created_at: now.toISOString() })
    .eq('id', existing.id)
    .is('processed_at', null)
    .select('id');

  return (takeover.data?.length ?? 0) > 0 ? 'claimed' : 'duplicate';
}

export async function completePaymongoEvent(
  supabase: Sb,
  eventId: string,
  now: Date = new Date()
): Promise<void> {
  const { error } = await supabase
    .from('processed_paymongo_events')
    .update({ processed_at: now.toISOString() })
    .eq('event_id', eventId)
    .is('processed_at', null);
  if (error) console.error('[paymongo-dedupe] complete failed:', error.message);
}

export async function releasePaymongoEvent(supabase: Sb, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('processed_paymongo_events')
    .delete()
    .eq('event_id', eventId)
    .is('processed_at', null);
  if (error) console.error('[paymongo-dedupe] release failed:', error.message);
}
