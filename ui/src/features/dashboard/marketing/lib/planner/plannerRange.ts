/**
 * Marketing Planner range math (client mirror of the server ranges).
 *
 * Pure so it can be unit-tested in the Node Vitest environment, which cannot render
 * components.
 */

export const PLANNER_RANGES = ['today', '3d', '5d', '7d'] as const;
export type PlannerRange = (typeof PLANNER_RANGES)[number];

export const RANGE_LABELS: Record<PlannerRange, string> = {
  today: 'Today',
  '3d': '3 days',
  '5d': '5 days',
  '7d': 'Week',
};

const RANGE_DAYS: Record<PlannerRange, number> = { today: 0, '3d': 2, '5d': 4, '7d': 6 };

export function isPlannerRange(value: unknown): value is PlannerRange {
  return typeof value === 'string' && (PLANNER_RANGES as readonly string[]).includes(value);
}

/** Normalize an unknown `?range=` value without an error toast. */
export function normalizePlannerRange(value: unknown): PlannerRange {
  return isPlannerRange(value) ? value : 'today';
}

export function addDaysYmd(ymd: string, deltaDays: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/** Inclusive calendar range for a chip. */
export function resolveRangeWindow(
  range: PlannerRange,
  today: string
): { from: string; to: string } {
  return { from: today, to: addDaysYmd(today, RANGE_DAYS[range]) };
}

/** Group items by their Manila calendar day, in order. */
export function groupItemsByDay<T extends { scheduledFor: string | null }>(
  items: readonly T[]
): Array<{ day: string; items: T[] }> {
  const byDay = new Map<string, T[]>();
  for (const item of items) {
    const day = item.scheduledFor ? item.scheduledFor.slice(0, 10) : 'unscheduled';
    const bucket = byDay.get(day);
    if (bucket) bucket.push(item);
    else byDay.set(day, [item]);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, dayItems]) => ({ day, items: dayItems }));
}

export function formatDayHeading(day: string, today: string): string {
  if (day === 'unscheduled') return 'Anytime';
  if (day === today) return 'Today';
  if (day === addDaysYmd(today, 1)) return 'Tomorrow';
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

/** `19:00` from an ISO timestamp with the Manila offset. */
export function formatItemTime(scheduledFor: string | null): string | null {
  if (!scheduledFor) return null;
  const match = scheduledFor.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${minutes} ${suffix}`;
}
