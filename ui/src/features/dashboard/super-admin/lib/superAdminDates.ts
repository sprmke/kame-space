/**
 * Date helpers for the super-admin console.
 *
 * Approval payloads come back from Postgres `timestamptz` text in the form
 * `2026-11-16T19:21:40+00` (offset without minutes), which `new Date()` rejects in
 * V8. These helpers normalise that shape, then fall back cleanly instead of
 * rendering "Invalid Date" or leaking the raw ISO string.
 */

function normaliseIsoLike(value: string): string {
  // Date-only values are local calendar days, not instants.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // "+00" / "-07" / "+0000" -> "+00:00" / "-07:00"
  if (/[+-]\d{2}$/.test(value)) return `${value}:00`;
  if (/[+-]\d{4}$/.test(value)) {
    return `${value.slice(0, -2)}:${value.slice(-2)}`;
  }
  return value;
}

export function parseSuperAdminDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalised = normaliseIsoLike(trimmed);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalised);
  const date = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : new Date(normalised);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function superAdminDateParts(value: string | null | undefined): {
  month: string;
  day: string;
  year: string;
} | null {
  const date = parseSuperAdminDate(value);
  if (!date) return null;
  return {
    month: date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short' }),
    day: date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', day: 'numeric' }),
    year: date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' }),
  };
}

/** Short date, e.g. "Nov 16, 2026". Falls back to an em dash when missing or invalid. */
export function formatSuperAdminDate(
  value: string | null | undefined,
  fallback = '-'
): string {
  const date = parseSuperAdminDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Short date and time in Asia/Manila, e.g. "Nov 16, 2026, 3:21 AM". */
export function formatSuperAdminDateTime(
  value: string | null | undefined,
  fallback = '-'
): string {
  const date = parseSuperAdminDate(value);
  if (!date) return fallback;
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
