/**
 * Marketing Planner tracked links.
 *
 * Every plan item carries a short code. Links to the property page append
 * `utm_campaign=ks-<code>` so page views and (later) booking requests can be
 * attributed back to the item that brought them.
 *
 * Pure: no clock, no DB, no network.
 */

export const TRACKED_MEDIUM = 'social';
export const CAMPAIGN_PREFIX = 'ks-';
export const SHORT_CODE_LENGTH = 8;

/** No 0/O, 1/l/i: a host may read one out loud or type it. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Short code from random bytes (crypto.getRandomValues at the call site). */
export function formatShortCode(bytes: Uint8Array): string {
  let out = '';
  for (let index = 0; index < SHORT_CODE_LENGTH; index += 1) {
    out += ALPHABET[bytes[index % bytes.length] % ALPHABET.length];
  }
  return out;
}

export function isValidShortCode(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === SHORT_CODE_LENGTH &&
    [...value].every((char) => ALPHABET.includes(char))
  );
}

export function campaignCode(shortCode: string): string {
  return `${CAMPAIGN_PREFIX}${shortCode}`;
}

/** `ks-abcd2345` -> `abcd2345`; null when it is not one of ours. */
export function shortCodeFromCampaign(campaign: string | null | undefined): string | null {
  if (!campaign || !campaign.startsWith(CAMPAIGN_PREFIX)) return null;
  const code = campaign.slice(CAMPAIGN_PREFIX.length);
  return isValidShortCode(code) ? code : null;
}

const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

/**
 * Append tracking to an absolute URL. Existing tracking params are replaced, never
 * duplicated, so a re-saved item does not grow its own URL.
 */
export function buildTrackedUrl(
  baseUrl: string,
  input: { channel: string; shortCode: string }
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', input.channel);
  url.searchParams.set('utm_medium', TRACKED_MEDIUM);
  url.searchParams.set('utm_campaign', campaignCode(input.shortCode));
  return url.toString();
}

/** Real links in a caption: drop tracking params from a tracked URL for display. */
export function stripTracking(url: string): string {
  const parsed = new URL(url);
  for (const param of TRACKING_PARAMS) parsed.searchParams.delete(param);
  return parsed.toString();
}

export type AttributionInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  landingAt?: string | null;
};

export type Attribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  planItemCode: string | null;
  landingAt: string | null;
};

const MAX_VALUE_LENGTH = 120;
const MAX_PATH_LENGTH = 512;

function clean(value: string | null | undefined, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Sanitize what the booking form sends. Allow-listed keys only, length-capped, no
 * identifiers: a code and a landing path cannot become a PII channel.
 */
export function sanitizeAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as AttributionInput;
  const utmCampaign = clean(input.utmCampaign, MAX_VALUE_LENGTH);
  const landingAt = clean(input.landingAt, MAX_PATH_LENGTH);
  const attribution: Attribution = {
    utmSource: clean(input.utmSource, MAX_VALUE_LENGTH),
    utmMedium: clean(input.utmMedium, MAX_VALUE_LENGTH),
    utmCampaign,
    planItemCode: shortCodeFromCampaign(utmCampaign),
    landingAt: landingAt && landingAt.startsWith('/') ? landingAt : null,
  };
  if (
    !attribution.utmSource &&
    !attribution.utmMedium &&
    !attribution.utmCampaign &&
    !attribution.landingAt
  ) {
    return null;
  }
  return attribution;
}
