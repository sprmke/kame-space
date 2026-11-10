/**
 * How long a host usually takes to answer a new booking request.
 *
 * There is no per-transition history table, so the first response is measured as the gap
 * between the booking being created and the first status change away from `PENDING_REVIEW`
 * (`status_updated_at`). That is the moment the host first acted on it.
 *
 * Below `MIN_RESPONSE_SAMPLES` answered requests the property has no real signal, so the
 * copy falls back to the generic line (plan D11).
 */

import { createServiceClient } from './orgAuth.ts';
import { MIN_RESPONSE_SAMPLES } from './guestJourneyCopy.ts';

/**
 * Median hours between a request and the host's first action, or `null` when the property
 * has too few answered requests to quote a number.
 */
export async function resolvePropertyMedianFirstResponseHours(
  propertyId: string | null | undefined
): Promise<number | null> {
  const id = String(propertyId ?? '').trim();
  if (!id) return null;

  const { data, error } = await createServiceClient()
    .from('guest_submissions')
    .select('created_at, status_updated_at, status')
    .eq('property_id', id)
    .is('parking_id', null)
    .not('status_updated_at', 'is', null)
    .neq('status', 'PENDING_REVIEW')
    .neq('status', 'CANCELLED')
    .limit(100);

  if (error || !data || data.length < MIN_RESPONSE_SAMPLES) return null;

  const hours: number[] = [];
  for (const row of data) {
    const created = new Date(String(row.created_at ?? '')).getTime();
    const updated = new Date(String(row.status_updated_at ?? '')).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(updated)) continue;
    const diffHours = (updated - created) / 3_600_000;
    // Ignore nonsense (clock skew, a backdated import) rather than skewing the median.
    if (diffHours < 0 || diffHours > 24 * 60) continue;
    hours.push(diffHours);
  }
  if (hours.length < MIN_RESPONSE_SAMPLES) return null;

  hours.sort((a, b) => a - b);
  const mid = Math.floor(hours.length / 2);
  const median =
    hours.length % 2 === 0 ? (hours[mid - 1]! + hours[mid]!) / 2 : hours[mid]!;
  return Math.round(median * 10) / 10;
}
