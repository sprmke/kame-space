/** Host nightly rate limits. Mirrors `PARKING_MIN_NIGHTLY_RATE` in `_shared/parkingGuestFee.ts`. */
export const PARKING_MIN_NIGHTLY_RATE = 100;
/** Input step hint only; the server accepts any whole or decimal rate at or above the minimum. */
export const PARKING_RATE_STEP = 50;

export const PARKING_MIN_RATE_MESSAGE = `Rates must be at least ₱${PARKING_MIN_NIGHTLY_RATE}.`;

/** A cleared draft is NaN, so it is invalid and never saved. */
export function isValidParkingRate(value: number): boolean {
  return Number.isFinite(value) && value >= PARKING_MIN_NIGHTLY_RATE;
}
