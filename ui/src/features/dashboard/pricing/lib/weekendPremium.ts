/**
 * Weekend premium as a percent of the weekday (base) rate.
 * Empty or non-positive weekday returns 0 so mid-clear / zero rates never explode the KPI.
 */
export function weekendPremiumPercent(weekdayRate: number, weekendRate: number): number {
  if (!Number.isFinite(weekdayRate) || !Number.isFinite(weekendRate) || weekdayRate <= 0) {
    return 0;
  }
  const pct = Math.round(((weekendRate - weekdayRate) / weekdayRate) * 100);
  return Number.isFinite(pct) ? pct : 0;
}

/** Host-facing label: `0%`, `+17%`, or `-10%`. */
export function formatWeekendPremiumPercent(pct: number): string {
  if (!Number.isFinite(pct) || pct === 0) return '0%';
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}
