/**
 * Which properties an org is billed for. Archived listings are off the bill (they are un-slotted
 * when archived and never re-slotted by a plan change), everything else (live, paused,
 * suspended) is billed. One definition for checkout, quotes, renewals, reward grants and admin
 * assignment so the amount a host sees always matches the amount charged.
 */

import { createClient } from './supabaseJs.ts';

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

const PAGE_SIZE = 1000;

export async function listBillablePropertyIds(organizationId: string): Promise<string[]> {
  const sb = db();
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('properties')
      .select('id')
      .eq('organization_id', organizationId)
      // `neq` alone drops NULL rows, so keep live properties explicitly.
      .or('inactive_reason.is.null,inactive_reason.neq.archived')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    ids.push(...rows.map((row) => row.id as string));
    if (rows.length < PAGE_SIZE) break;
  }
  return ids;
}
