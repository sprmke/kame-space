#!/usr/bin/env bun
/**
 * Walk an org's billing lifecycle in minutes (local Supabase only).
 *
 * "Travelling forward N days" moves every stored billing date of the org's live subscription N
 * days into the past (period, grace, suspension, scheduled change) and ages its open checkout,
 * then optionally runs the hourly billing cron so the next transition happens for real.
 *
 * Usage:
 *   bun run billing:time-travel -- --org <slug|id> --status
 *   bun run billing:time-travel -- --org <slug|id> --days 31 --run
 *   bun run billing:time-travel -- --org <slug|id> --days 35 --run     # past due -> suspended
 *   bun run billing:time-travel -- --org <slug|id> --run               # just run the cron
 *
 * Flags: --days N (forward), --run (POST platform-billing-cron after shifting), --status (print
 * only). Refuses any non-local SUPABASE_URL. Plan: docs/workflow/in-progress/plans-billing-lifecycle-hardening.md
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
  console.error(`Refusing to time-travel ${url}. This script only runs against local Supabase.`);
  process.exit(2);
}

// Public local-stack demo key (same one every `supabase start` uses).
const LOCAL_DEMO_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_DEMO_SERVICE_KEY;

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE = ['active', 'trialing', 'past_due', 'suspended'];

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  return process.argv[index + 1] && !process.argv[index + 1].startsWith('--')
    ? process.argv[index + 1]
    : 'true';
}

const orgRef = arg('org');
const days = arg('days') ? Number(arg('days')) : 0;
const shouldRun = arg('run') != null;
const statusOnly = arg('status') != null;

if (!orgRef) {
  console.error('Missing --org <slug|id>.');
  process.exit(2);
}
if (!Number.isFinite(days)) {
  console.error('--days must be a number.');
  process.exit(2);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgRef);
const { data: org, error: orgError } = await supabase
  .from('organizations')
  .select('id, slug, name')
  .eq(isUuid ? 'id' : 'slug', orgRef)
  .maybeSingle();
if (orgError || !org) {
  console.error(`Organization "${orgRef}" not found: ${orgError?.message ?? 'no match'}`);
  process.exit(1);
}

const DATE_COLUMNS = [
  'current_period_start',
  'current_period_end',
  'grace_period_ends_at',
  'suspended_at',
  'scheduled_change_at',
] as const;

async function loadSubscription() {
  const { data, error } = await supabase
    .from('org_subscriptions')
    .select(
      `id, status, source, plan_id, ${DATE_COLUMNS.join(', ')}, scheduled_plan_id, cancel_at_period_end, period_paid_php`
    )
    .eq('organization_id', org!.id)
    .in('status', LIVE)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

async function describe(label: string) {
  const sub = await loadSubscription();
  const { data: pending } = await supabase
    .from('org_payment_transactions')
    .select('id, purpose, amount, created_at, expires_at')
    .eq('organization_id', org!.id)
    .eq('status', 'pending');
  const { data: balance } = await supabase.rpc('org_billing_balance', {
    p_organization_id: org!.id,
  });
  console.log(`\n[${label}] ${org!.name} (${org!.slug})`);
  if (!sub) {
    console.log('  Free (no live subscription)');
  } else {
    console.log(`  status ${sub.status}, source ${sub.source}`);
    for (const column of DATE_COLUMNS) {
      if (sub[column]) console.log(`  ${column.padEnd(22)} ${sub[column]}`);
    }
    if (sub.scheduled_plan_id) console.log(`  scheduled_plan_id      ${sub.scheduled_plan_id}`);
    if (sub.cancel_at_period_end) console.log('  cancel_at_period_end   true');
  }
  console.log(`  pending checkouts      ${pending?.length ?? 0}`);
  console.log(`  ledger balance         ${balance ?? 0} (negative = account credit)`);
}

async function shiftForward(forwardDays: number) {
  const sub = await loadSubscription();
  if (!sub) {
    console.log('No live subscription to shift.');
    return;
  }
  const delta = forwardDays * DAY_MS;
  const patch: Record<string, string> = {};
  for (const column of DATE_COLUMNS) {
    const value = sub[column];
    if (typeof value === 'string')
      patch[column] = new Date(Date.parse(value) - delta).toISOString();
  }
  const { error } = await supabase
    .from('org_subscriptions')
    .update(patch)
    .eq('id', sub.id as string);
  if (error) throw new Error(error.message);

  // Age the open checkout the same way so the TTL sweep and reconciliation paths can run.
  const { data: pending } = await supabase
    .from('org_payment_transactions')
    .select('id, created_at, expires_at')
    .eq('organization_id', org!.id)
    .eq('status', 'pending');
  for (const row of pending ?? []) {
    const rowPatch: Record<string, string> = {
      created_at: new Date(Date.parse(row.created_at as string) - delta).toISOString(),
    };
    if (row.expires_at) {
      rowPatch.expires_at = new Date(Date.parse(row.expires_at as string) - delta).toISOString();
    }
    await supabase
      .from('org_payment_transactions')
      .update(rowPatch)
      .eq('id', row.id as string);
  }
  console.log(`\nMoved ${forwardDays} day(s) forward.`);
}

async function runCron() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serviceKey}`,
  };
  const secret = process.env.PLATFORM_BILLING_CRON_SECRET;
  if (secret) headers['x-platform-billing-cron-secret'] = secret;
  const response = await fetch(`${url}/functions/v1/platform-billing-cron`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const text = await response.text();
  console.log(`\nplatform-billing-cron -> ${response.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
  if (!response.ok) process.exitCode = 1;
}

await describe('before');
if (!statusOnly) {
  if (days !== 0) await shiftForward(days);
  if (shouldRun) await runCron();
  if (days !== 0 || shouldRun) await describe('after');
}
