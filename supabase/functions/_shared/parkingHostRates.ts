/**
 * Public read of the host-set nightly rates (`parking_settings`). Hosts own the rate, so cards,
 * detail and search all show this value; the guest service fee is added at checkout.
 */

import { createServiceClient } from './orgAuth.ts';

export const DEFAULT_PUBLIC_PARKING_WEEKDAY = 300;
export const DEFAULT_PUBLIC_PARKING_WEEKEND = 400;

export type ParkingHostRate = { weekday: number; weekend: number };

function money(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** One entry per requested id; a missing settings row falls back to the seeded defaults. */
export async function loadParkingHostRates(ids: string[]): Promise<Map<string, ParkingHostRate>> {
  const out = new Map<string, ParkingHostRate>();
  for (const id of ids) {
    out.set(id, {
      weekday: DEFAULT_PUBLIC_PARKING_WEEKDAY,
      weekend: DEFAULT_PUBLIC_PARKING_WEEKEND,
    });
  }
  if (ids.length === 0) return out;

  const supabase = createServiceClient();
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('parking_settings')
      .select('parking_id, weekday_nightly_rate, weekend_nightly_rate')
      .in('parking_id', ids.slice(i, i + CHUNK))
      .limit(CHUNK);
    if (error) throw new Error(`Failed to load parking rates: ${error.message}`);
    for (const row of data ?? []) {
      const weekday = money(row.weekday_nightly_rate, DEFAULT_PUBLIC_PARKING_WEEKDAY);
      out.set(String(row.parking_id), {
        weekday,
        weekend: money(row.weekend_nightly_rate, DEFAULT_PUBLIC_PARKING_WEEKEND),
      });
    }
  }
  return out;
}
