/**
 * Planner open state lives on `?plan=1` (not a studio tab), so the four creative
 * tabs stay AI Studio / Posts / Videos / Calendar.
 */

export const PLANNER_OPEN_PARAM = 'plan';
export const PLANNER_OPEN_VALUE = '1';

/** True when the Marketing Planner modal should be open. */
export function isPlannerOpen(params: URLSearchParams | { get: (key: string) => string | null }): boolean {
  const value = params.get(PLANNER_OPEN_PARAM);
  return value === PLANNER_OPEN_VALUE || value === 'open' || value === 'true';
}

/** Set or clear the planner open flag on a search-params copy. */
export function setPlannerOpen(params: URLSearchParams, open: boolean): void {
  if (open) params.set(PLANNER_OPEN_PARAM, PLANNER_OPEN_VALUE);
  else params.delete(PLANNER_OPEN_PARAM);
}

/**
 * Legacy Plan tab (`?tab=plan`) → open the planner modal and drop the retired tab
 * so the studio lands on a real creative tab.
 * Returns true when params were mutated.
 */
export function migrateLegacyPlanTab(params: URLSearchParams): boolean {
  if (params.get('tab') !== 'plan') return false;
  params.delete('tab');
  setPlannerOpen(params, true);
  return true;
}
