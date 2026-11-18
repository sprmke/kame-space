/**
 * Echo detection for multi-channel calendar sync.
 * Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.4
 *
 * An echo is a channel repeating nights we told it about. Booking.com exports every closed night
 * as `CLOSED - Not available`, so without this an echo becomes a phantom placeholder booking and
 * a fake conflict. Pure module: no DB, no clock, unit-tested.
 *
 * Date model is half-open `[start, end)` in `YYYY-MM-DD`, identical to the rest of the engine.
 */

export interface ServedRange {
  start: string;
  end: string;
}

export interface EchoCandidate {
  startDate: string;
  endDate: string;
  /** True when the VEVENT read as a reservation (`Reserved`, or a Booking.com event with ingestion on). */
  kind: 'reservation' | 'block';
}

/** How long a served range stays in echo memory after a channel last read it. */
export const EXPORT_ECHO_WINDOW_HOURS = 72;

/** A Booking.com pull with this many exact matches almost certainly exported closed dates too. */
export const BOOKING_COM_CLOSED_DATES_MATCH_THRESHOLD = 2;

function overlaps(a: ServedRange, b: ServedRange): boolean {
  return a.start < b.end && b.start < a.end;
}

function merge(ranges: ServedRange[]): ServedRange[] {
  const sorted = [...ranges].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const out: ServedRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) {
      if (r.end > last.end) last.end = r.end;
      continue;
    }
    out.push({ start: r.start, end: r.end });
  }
  return out;
}

/** True when `target` is fully inside the union of `served`. Partial overlap is not coverage. */
export function isFullyCovered(target: ServedRange, served: ServedRange[]): boolean {
  if (!target.start || !target.end || target.end <= target.start) return false;
  const candidates = merge(served.filter((r) => overlaps(r, target)));
  let cursor = target.start;
  for (const r of candidates) {
    if (r.start > cursor) return false;
    if (r.end > cursor) cursor = r.end;
    if (cursor >= target.end) return true;
  }
  return cursor >= target.end;
}

/**
 * Airbnb reads `Reserved` as a real stay and its feed carries a confirmation code, so a
 * reservation on that channel is proof and is never an echo. Every other channel sends dates
 * only, so coverage is the only signal we have.
 */
export function channelProvesReservation(
  provider: string,
  event: Pick<EchoCandidate, 'kind'>
): boolean {
  return provider === 'airbnb' && event.kind === 'reservation';
}

export interface EchoDecision {
  isEcho: boolean;
  reason?: 'covered_by_served_ranges' | 'reservation_proof';
}

/**
 * Decide whether an imported event is the channel repeating our own export.
 * `served` is the union of ranges served to **this** channel inside the echo window.
 */
export function classifyExportEcho(
  provider: string,
  event: EchoCandidate,
  served: ServedRange[]
): EchoDecision {
  if (channelProvesReservation(provider, event)) {
    return { isEcho: false, reason: 'reservation_proof' };
  }
  const covered = isFullyCovered({ start: event.startDate, end: event.endDate }, served);
  return covered ? { isEcho: true, reason: 'covered_by_served_ranges' } : { isEcho: false };
}

/** Events whose range exactly equals a served range (the Booking.com "reserved and closed" tell). */
export function countExactServedMatches(
  events: Pick<EchoCandidate, 'startDate' | 'endDate'>[],
  served: ServedRange[]
): number {
  if (served.length === 0) return 0;
  const keys = new Set(served.map((r) => `${r.start}|${r.end}`));
  let count = 0;
  for (const event of events) {
    if (keys.has(`${event.startDate}|${event.endDate}`)) count++;
  }
  return count;
}

/** True when a pull looks like Booking.com exported "reserved and closed dates" instead of reserved only. */
export function isClosedDatesEchoPull(
  provider: string,
  events: Pick<EchoCandidate, 'startDate' | 'endDate'>[],
  served: ServedRange[]
): boolean {
  if (provider !== 'booking_com') return false;
  return countExactServedMatches(events, served) >= BOOKING_COM_CLOSED_DATES_MATCH_THRESHOLD;
}
