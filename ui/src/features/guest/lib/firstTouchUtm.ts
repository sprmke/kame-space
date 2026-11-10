/**
 * First-touch UTM capture for guest attribution.
 *
 * The first public page a visitor lands on wins: later navigation keeps the original
 * campaign, so a booking request can be traced back to the post that brought the guest.
 * Stored in sessionStorage, never in a cookie, and it holds campaign values only.
 */

export const FIRST_TOUCH_KEY = 'gfm-first-touch-utm';

export type FirstTouchUtm = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingAt: string | null;
};

const MAX_VALUE_LENGTH = 120;
const MAX_PATH_LENGTH = 512;

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function clean(value: string | null, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function parseFirstTouch(
  search: string,
  pathname: string
): FirstTouchUtm | null {
  const params = new URLSearchParams(search);
  const utmSource = clean(params.get('utm_source'), MAX_VALUE_LENGTH);
  const utmMedium = clean(params.get('utm_medium'), MAX_VALUE_LENGTH);
  const utmCampaign = clean(params.get('utm_campaign'), MAX_VALUE_LENGTH);
  if (!utmSource && !utmMedium && !utmCampaign) return null;
  return {
    utmSource,
    utmMedium,
    utmCampaign,
    landingAt: clean(pathname, MAX_PATH_LENGTH),
  };
}

/**
 * Capture once. A visit without UTM params is not "no attribution": it is the absence of
 * a first touch, so nothing is written and a later tracked link can still claim the visit.
 */
export function captureFirstTouch(
  search: string,
  pathname: string,
  storage: StorageLike | null
): FirstTouchUtm | null {
  if (!storage) return null;
  try {
    const existing = storage.getItem(FIRST_TOUCH_KEY);
    if (existing) {
      const parsed = readFirstTouch(storage);
      // Corrupt or empty stored value: fall through and rewrite it.
      if (parsed) return parsed;
    }
  } catch {
    return null;
  }
  const parsed = parseFirstTouch(search, pathname);
  if (!parsed) return null;
  try {
    storage.setItem(FIRST_TOUCH_KEY, JSON.stringify(parsed));
  } catch {
    // Private mode or a full quota: attribution is a nice-to-have.
  }
  return parsed;
}

export function readFirstTouch(storage: StorageLike | null): FirstTouchUtm | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(FIRST_TOUCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FirstTouchUtm>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      utmSource: clean(parsed.utmSource ?? null, MAX_VALUE_LENGTH),
      utmMedium: clean(parsed.utmMedium ?? null, MAX_VALUE_LENGTH),
      utmCampaign: clean(parsed.utmCampaign ?? null, MAX_VALUE_LENGTH),
      landingAt: clean(parsed.landingAt ?? null, MAX_PATH_LENGTH),
    };
  } catch {
    return null;
  }
}

/** JSON payload for the booking form's `attribution` field, or null when there is none. */
export function firstTouchPayload(storage: StorageLike | null): string | null {
  const utm = readFirstTouch(storage);
  if (!utm) return null;
  if (!utm.utmSource && !utm.utmMedium && !utm.utmCampaign && !utm.landingAt) return null;
  return JSON.stringify(utm);
}

export function sessionStorageSafe(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
