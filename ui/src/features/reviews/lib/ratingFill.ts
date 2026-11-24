/**
 * Star rendering maths for a read-only rating.
 *
 * Kept in `lib` so the fractional behaviour is unit tested: the component used to round,
 * which drew four full stars next to the number 3.6.
 */

/** Part of `star` (1–5) that is filled for a 0–5 rating. */
export function starFillRatio(value: number, star: number): number {
  const rating = Number.isFinite(value) ? value : 0;
  return Math.min(1, Math.max(0, rating - (star - 1)));
}

/** `4` stays `4`; `3.6` stays `3.6`, so a whole row does not gain a `.0`. */
export function spokenRating(value: number): string {
  const rating = Number.isFinite(value) ? value : 0;
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}
