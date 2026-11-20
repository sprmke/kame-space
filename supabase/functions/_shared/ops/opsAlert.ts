/**
 * Ops alert dispatcher (ledger PR-027, plan `production-error-escalation` Phase 1).
 *
 * One dedupe row per alert key in `ops_alerts`, re-notified on a per-tier interval and
 * collapsed by a storm guard. Telegram is the primary push channel; Resend email is the
 * backup for P0/P1. Every send is short-timeouted and failure-tolerant: an alert path must
 * never break the request that raised it, and an alert about a broken channel must not loop.
 *
 * Operator setup (see `docs/archive/operations/alerting-setup.md`):
 *   TELEGRAM_OPS_BOT_TOKEN, TELEGRAM_OPS_CHAT_ID, OPS_ALERT_EMAILS, OPS_ALERT_INGEST_SECRET
 *   OPS_ALERTS_ENABLED=true (production only; local `functions serve` never pages)
 */

import { runAfterResponse } from '../backgroundTask.ts';
import { createServiceClient } from '../orgAuth.ts';
import { isProductionEnv } from '../systemHealth/types.ts';

export type OpsAlertTier = 'p0' | 'p1' | 'p2' | 'p3' | 'drill';
export type OpsAlertSource =
  'edge' | 'journey' | 'job' | 'ci' | 'deploy' | 'probe' | 'sentry' | 'log_scan' | 'vendor';

export type OpsAlertInput = {
  key: string;
  tier: OpsAlertTier;
  source: OpsAlertSource;
  title: string;
  summary?: string | null;
  links?: Record<string, string>;
  context?: Record<string, unknown>;
};

export type OpsAlertRow = {
  id: string;
  alert_key: string;
  tier: OpsAlertTier;
  source: OpsAlertSource;
  title: string;
  summary: string | null;
  links: Record<string, string> | null;
  context: Record<string, unknown> | null;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  occurrences: number;
  last_notified_at: string | null;
  notify_count: number;
};

export type OpsAlertOutcome = {
  notified: boolean;
  storm?: boolean;
  skipped?: 'disabled' | 'invalid' | 'db' | 'error';
};

const RE_NOTIFY_MS: Record<OpsAlertTier, number> = {
  p0: 15 * 60 * 1000,
  p1: 60 * 60 * 1000,
  p2: 6 * 60 * 60 * 1000,
  p3: 24 * 60 * 60 * 1000,
  drill: 0,
};

const STORM_WINDOW_MS = 5 * 60 * 1000;
const STORM_THRESHOLD = 10;
const SEND_TIMEOUT_MS = 5000;
const MAX_TEXT = 280;

const OPS_ALERT_COLUMNS =
  'id,alert_key,tier,source,title,summary,links,context,status,first_seen_at,last_seen_at,occurrences,last_notified_at,notify_count';

const TIER_MARKER: Record<OpsAlertTier, string> = {
  p0: '🔴 P0',
  p1: '🟠 P1',
  p2: '🟡 P2',
  p3: '⚪ P3',
  drill: '🧪 DRILL',
};

export function reNotifyIntervalMs(tier: OpsAlertTier): number {
  return RE_NOTIFY_MS[tier] ?? RE_NOTIFY_MS.p3;
}

/** New alert → notify. Existing → notify only when its tier interval has elapsed. */
export function shouldNotify(
  existing: Pick<OpsAlertRow, 'last_notified_at'> | null,
  tier: OpsAlertTier,
  now: Date = new Date()
): boolean {
  if (!existing) return true;
  if (tier === 'drill') return true;
  if (!existing.last_notified_at) return true;
  const last = Date.parse(existing.last_notified_at);
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= reNotifyIntervalMs(tier);
}

/** More than 10 notifications in 5 minutes collapses into one summary message. */
export function isStorm(
  notifiedAt: Array<string | null | undefined>,
  now: Date = new Date()
): boolean {
  const since = now.getTime() - STORM_WINDOW_MS;
  const count = notifiedAt.filter((value) => {
    if (!value) return false;
    const ts = Date.parse(value);
    return Number.isFinite(ts) && ts >= since;
  }).length;
  return count > STORM_THRESHOLD;
}

export function opsAlertsEnabled(
  get: (key: string) => string | undefined = (key) => Deno.env.get(key)
): boolean {
  if (get('OPS_ALERTS_FORCE_SEND') === 'true') return true;
  // No configured channel means there is nothing to page, so never do the DB work. This also
  // keeps unrelated test runs (which set ENVIRONMENT=production for cron gates) quiet.
  const hasChannel = Boolean(
    get('TELEGRAM_OPS_BOT_TOKEN')?.trim() ||
    get('TELEGRAM_OPS_CHAT_ID')?.trim() ||
    get('OPS_ALERT_EMAILS')?.trim()
  );
  if (!hasChannel) return false;
  if (get('OPS_ALERTS_ENABLED') === 'true') return true;
  return isProductionEnv(get);
}

export function scrubOpsAlertText(value: unknown, max = MAX_TEXT): string {
  const text = String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeLinks(links: Record<string, string> | null | undefined): Array<[string, string]> {
  if (!links) return [];
  return Object.entries(links)
    .filter(([, url]) => /^https:\/\//i.test(String(url)))
    .slice(0, 4)
    .map(([label, url]) => [scrubOpsAlertText(label, 24), String(url)]);
}

function manilaClock(iso: string | null | undefined): string {
  if (!iso) return '-';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '-';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts));
}

export function formatOpsAlertMessage(row: OpsAlertRow): string {
  const marker = TIER_MARKER[row.tier] ?? TIER_MARKER.p3;
  const lines = [`<b>${marker} · ${escapeHtml(scrubOpsAlertText(row.title))}</b>`];
  if (row.summary) lines.push(escapeHtml(scrubOpsAlertText(row.summary)));
  const count = row.occurrences > 1 ? ` · x${row.occurrences}` : '';
  lines.push(
    `${escapeHtml(row.source)} · first ${manilaClock(row.first_seen_at)} · last ${manilaClock(
      row.last_seen_at
    )} Manila${count}`
  );
  const links = safeLinks(row.links);
  if (links.length) {
    lines.push(
      links
        .map(([label, url]) => `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`)
        .join(' · ')
    );
  }
  return lines.join('\n');
}

export function formatStormMessage(rows: OpsAlertRow[]): string {
  const top = rows
    .slice(0, 5)
    .map((row) => `· ${escapeHtml(scrubOpsAlertText(row.title, 80))}`)
    .join('\n');
  return `<b>⚠️ Alert storm: ${rows.length} alerts</b>\n${top}`;
}

async function withTimeout<T>(
  label: string,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } catch (error) {
    console.error(
      `[ops-alert] ${label} delivery failed:`,
      error instanceof Error ? error.message : error
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegram(message: string): Promise<boolean> {
  const token = Deno.env.get('TELEGRAM_OPS_BOT_TOKEN')?.trim();
  const chatId = Deno.env.get('TELEGRAM_OPS_CHAT_ID')?.trim();
  if (!token || !chatId) return false;

  const result = await withTimeout('telegram', (signal) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
  );
  return result?.ok === true;
}

async function sendOpsEmail(subject: string, message: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const recipients = (Deno.env.get('OPS_ALERT_EMAILS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!apiKey || recipients.length === 0) return false;

  const from = Deno.env.get('OPS_ALERT_FROM_EMAIL')?.trim() || 'Kame Space Ops <ops@kamespace.com>';
  const text = message.replace(/<[^>]+>/g, '');

  const result = await withTimeout('email', (signal) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({ from, to: recipients, subject: `[Ops] ${subject}`, text }),
    })
  );
  return result?.ok === true;
}

async function deliver(row: OpsAlertRow, message: string): Promise<void> {
  const telegram = await sendTelegram(message);
  // Email is the durable record and the backup when Telegram is down; P0/P1 only.
  if (row.tier === 'p0' || row.tier === 'p1' || row.tier === 'drill') {
    await sendOpsEmail(scrubOpsAlertText(row.title), message);
  }
  if (!telegram) {
    console.warn(`[ops-alert] telegram not configured or failed for ${row.alert_key}`);
  }
}

/**
 * Upsert + notify. Never throws; returns what happened so a caller (or a test) can inspect it.
 * `void` callers can use `raiseOpsAlertAfterResponse` to keep it off the response path.
 */
export async function raiseOpsAlert(input: OpsAlertInput): Promise<OpsAlertOutcome> {
  if (!opsAlertsEnabled()) return { notified: false, skipped: 'disabled' };
  if (!input.key?.trim() || !TIER_MARKER[input.tier] || !input.title?.trim()) {
    return { notified: false, skipped: 'invalid' };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const supabase = createServiceClient();

  try {
    const { data: existing } = await supabase
      .from('ops_alerts')
      .select(OPS_ALERT_COLUMNS)
      .eq('alert_key', input.key)
      .neq('status', 'resolved')
      .maybeSingle();

    let row = existing as OpsAlertRow | null;
    const payload = {
      tier: input.tier,
      source: input.source,
      title: scrubOpsAlertText(input.title),
      summary: input.summary ? scrubOpsAlertText(input.summary) : null,
      links: input.links ?? {},
      context: input.context ?? {},
      last_seen_at: nowIso,
      updated_at: nowIso,
    };

    if (row) {
      const { data } = await supabase
        .from('ops_alerts')
        .update({ ...payload, occurrences: row.occurrences + 1 })
        .eq('id', row.id)
        .select(OPS_ALERT_COLUMNS)
        .single();
      row = (data as OpsAlertRow | null) ?? row;
    } else {
      const { data, error } = await supabase
        .from('ops_alerts')
        .insert({ ...payload, alert_key: input.key, first_seen_at: nowIso })
        .select(OPS_ALERT_COLUMNS)
        .single();
      if (error) {
        if (error.code === '23505') return { notified: false, skipped: 'db' };
        console.error('[ops-alert] insert failed:', error.message);
        return { notified: false, skipped: 'db' };
      }
      row = data as OpsAlertRow;
    }

    if (!row) return { notified: false, skipped: 'db' };

    const isNew = !existing;
    if (!isNew && !shouldNotify(existing as OpsAlertRow, input.tier, now)) {
      return { notified: false };
    }

    const { data: recent } = await supabase
      .from('ops_alerts')
      .select(OPS_ALERT_COLUMNS)
      .gte('last_notified_at', new Date(now.getTime() - STORM_WINDOW_MS).toISOString())
      .order('last_notified_at', { ascending: false })
      .limit(STORM_THRESHOLD + 1);
    const recentRows = Array.isArray(recent) ? (recent as OpsAlertRow[]) : [];
    const storm = isStorm(
      recentRows.map((item) => item.last_notified_at),
      now
    );

    const message = storm ? formatStormMessage(recentRows) : formatOpsAlertMessage(row);
    await deliver(row, message);

    await supabase
      .from('ops_alerts')
      .update({ last_notified_at: nowIso, notify_count: (row.notify_count ?? 0) + 1 })
      .eq('id', row.id);

    return { notified: true, storm };
  } catch (error) {
    console.error('[ops-alert] raise failed:', error instanceof Error ? error.message : error);
    return { notified: false, skipped: 'error' };
  }
}

/** Fire-and-forget variant for request paths (never blocks or breaks the response). */
export async function raiseOpsAlertAfterResponse(input: OpsAlertInput): Promise<void> {
  await runAfterResponse(`ops-alert:${input.key}`, () => raiseOpsAlert(input));
}

/** Resolve one key and (when it had been notified) send a single recovery line. */
export async function resolveOpsAlert(key: string, note = 'Recovered'): Promise<OpsAlertOutcome> {
  if (!opsAlertsEnabled()) return { notified: false, skipped: 'disabled' };
  try {
    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from('ops_alerts')
      .update({ status: 'resolved', resolved_at: nowIso, updated_at: nowIso })
      .eq('alert_key', key)
      .neq('status', 'resolved')
      .select(OPS_ALERT_COLUMNS)
      .maybeSingle();
    const row = data as OpsAlertRow | null;
    if (!row || (row.notify_count ?? 0) === 0) return { notified: false };
    await sendTelegram(
      `✅ ${escapeHtml(scrubOpsAlertText(note))}: ${escapeHtml(scrubOpsAlertText(row.title))}`
    );
    return { notified: true };
  } catch (error) {
    console.error('[ops-alert] resolve failed:', error instanceof Error ? error.message : error);
    return { notified: false, skipped: 'error' };
  }
}
