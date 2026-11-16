import type { CalendarSyncEvent } from '@/features/dashboard/pricing/lib/calendarSyncApi';

import { formatStayDateRange } from '@/utils/format/dates';

export type CalendarSyncActivityTone = 'neutral' | 'success' | 'warning' | 'danger';

export type CalendarSyncActivityRow = {
  id: number;
  title: string;
  rangeLabel: string | null;
  relativeAt: string;
  tone: CalendarSyncActivityTone;
  createdAt: string;
};

/** Operational skips hosts do not need to see (rate limit / lock races / no-op). */
const HIDDEN_SKIP_REASONS = new Set(['min_interval_or_locked', 'no change']);

function detailReason(detail: Record<string, unknown> | null | undefined): string {
  const raw = detail?.reason;
  return typeof raw === 'string' ? raw.trim() : '';
}

function formatEventRange(start: string | null, end: string | null): string | null {
  if (!start?.trim()) return null;
  return formatStayDateRange(start, end?.trim() || start);
}

function skipTitle(reason: string): string {
  switch (reason) {
    case 'empty_feed_pull_1':
      return 'Empty calendar check';
    case 'past_stay':
      return 'Past stay ignored';
    case 'past_checkin_feed_drop':
      return 'Past booking left as is';
    case 'reschedule_after_review':
      return 'Airbnb dates changed after review';
    case 'uid_on_other_feed':
      return 'Already on another feed';
    case 'adopt_race':
    case 'relink_race':
      return 'Already linked';
    case 'no change':
      return 'No changes';
    default:
      if (!reason) return 'Skipped';
      // Parse warnings and rare codes stay short; never dump snake_case when we know a label.
      if (/^[a-z0-9_]+$/i.test(reason) && reason.includes('_')) {
        return 'Skipped';
      }
      return reason.length > 72 ? `${reason.slice(0, 69)}…` : reason;
  }
}

function eventTitle(e: CalendarSyncEvent): string {
  switch (e.action) {
    case 'block_created':
      return 'Busy dates imported';
    case 'block_updated':
      return 'Busy dates updated';
    case 'block_removed':
      return 'Busy dates cleared';
    case 'booking_created':
      return 'Booking added';
    case 'booking_linked':
      return 'Booking linked';
    case 'booking_rescheduled':
      return 'Booking dates updated';
    case 'booking_cancelled':
      return 'Booking cancelled';
    case 'conflict_detected':
      return 'Date conflict';
    case 'error': {
      const reason = detailReason(e.detail);
      return reason ? `Sync failed · ${reason}` : 'Sync failed';
    }
    case 'skipped':
      return skipTitle(detailReason(e.detail) || 'no change');
    default:
      return e.action.replace(/_/g, ' ');
  }
}

function eventTone(e: CalendarSyncEvent): CalendarSyncActivityTone {
  switch (e.action) {
    case 'error':
    case 'conflict_detected':
      return 'danger';
    case 'booking_cancelled':
    case 'block_removed':
      return 'warning';
    case 'booking_created':
    case 'booking_linked':
    case 'block_created':
      return 'success';
    case 'skipped':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** True when this audit row is host-facing (not cron lock noise). */
export function isHostFacingCalendarSyncEvent(e: CalendarSyncEvent): boolean {
  if (e.action !== 'skipped') return true;
  return !HIDDEN_SKIP_REASONS.has(detailReason(e.detail));
}

/**
 * Host-facing Channel sync activity rows.
 * Hides rate-limit skips, humanizes labels, formats stay ranges.
 */
export function buildCalendarSyncActivityRows(
  events: CalendarSyncEvent[],
  formatRelative: (iso: string) => string,
  limit = 8
): CalendarSyncActivityRow[] {
  const rows: CalendarSyncActivityRow[] = [];
  for (const e of events) {
    if (!isHostFacingCalendarSyncEvent(e)) continue;
    rows.push({
      id: e.id,
      title: eventTitle(e),
      rangeLabel: formatEventRange(e.start_date, e.end_date),
      relativeAt: formatRelative(e.created_at),
      tone: eventTone(e),
      createdAt: e.created_at,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}
