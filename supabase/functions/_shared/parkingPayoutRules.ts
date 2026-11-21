/** Pure money checks for parking payout actions. */
export function parkingRefundAmountError(amount: number, guestCharge: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'amount must be a positive number';
  if (amount > guestCharge + 0.005) return 'amount cannot exceed the guest charge';
  return null;
}

/**
 * Payout hold (readiness PRK-04): the host is paid 24 hours after the parking start, so a
 * guest who arrives to a problem still has money on the table. Dates are date-level text in
 * the DB (`MM-DD-YYYY` or `YYYY-MM-DD`); the start instant is 14:00 Asia/Manila, matching the
 * platform check-in default.
 */
const MANILA_OFFSET_HOURS = 8;
const DEFAULT_PARKING_START_HOUR = 14;

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const trimmed = String(value ?? '').trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (match) {
    return { year: Number(match[3]), month: Number(match[1]), day: Number(match[2]) };
  }
  return null;
}

/** When a payout becomes eligible, or null when the start date is missing/malformed. */
export function parkingPayoutEligibleAt(startDate: string | null | undefined): Date | null {
  const ymd = parseYmd(String(startDate ?? ''));
  if (!ymd) return null;
  const start = new Date(
    Date.UTC(ymd.year, ymd.month - 1, ymd.day, DEFAULT_PARKING_START_HOUR - MANILA_OFFSET_HOURS, 0)
  );
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** Human-readable reason a payout is still held, or null when it may be disbursed. */
export function parkingPayoutHoldError(input: {
  startDate: string | null | undefined;
  now?: Date;
}): string | null {
  const eligibleAt = parkingPayoutEligibleAt(input.startDate);
  if (!eligibleAt) return null;
  const now = input.now ?? new Date();
  if (now.getTime() >= eligibleAt.getTime()) return null;
  return `Payout is held until 24 hours after the parking start (${eligibleAt.toISOString()}).`;
}
