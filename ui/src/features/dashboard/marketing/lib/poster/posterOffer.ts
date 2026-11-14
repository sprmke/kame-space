import { cleanPosterCopy } from '@/features/dashboard/marketing/lib/poster/posterSpec';

/**
 * A promo needs a real offer. The host types it, the poster prints it verbatim, and
 * nothing else on any poster may claim a discount. Pure: the edge director keeps a
 * mirror of the same rules (`readPosterOffer`) so a hand-made request cannot slip in
 * an expired or malformed offer.
 */

export type PosterOffer = {
  /** Printed as the headline, e.g. "20% off weekdays". */
  text: string;
  /** Last valid day, `YYYY-MM-DD` (Manila calendar), or null for open ended. */
  validUntil: string | null;
  /** Voucher code, upper case, or null. */
  code: string | null;
};

export const OFFER_TEXT_LIMIT = { words: 5, chars: 34 } as const;
export const OFFER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,15}$/;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today on the Manila calendar as `YYYY-MM-DD`. */
export function manilaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** A real calendar date in `YYYY-MM-DD`, or null. Rejects 2026-02-31 style dates. */
export function readOfferDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export type OfferProblem = 'missing-text' | 'bad-date' | 'expired' | 'bad-code';

/** Why the raw form values cannot become an offer, for the form to explain. */
export function offerProblem(
  raw: { text?: string; validUntil?: string; code?: string },
  today: string = manilaToday()
): OfferProblem | null {
  const text = cleanPosterCopy(raw.text ?? '', OFFER_TEXT_LIMIT);
  const anyDetail = Boolean(raw.validUntil?.trim() || raw.code?.trim());
  if (!text) return anyDetail || (raw.text ?? '').trim() ? 'missing-text' : null;
  if (raw.validUntil?.trim()) {
    const date = readOfferDate(raw.validUntil);
    if (!date) return 'bad-date';
    if (date < today) return 'expired';
  }
  const code = raw.code?.trim();
  if (code && !OFFER_CODE_PATTERN.test(code.toUpperCase())) return 'bad-code';
  return null;
}

/** The offer to print, or null when the host gave none or it is unusable or expired. */
export function sanitizePosterOffer(
  raw: unknown,
  today: string = manilaToday()
): PosterOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const text = cleanPosterCopy(source.text, OFFER_TEXT_LIMIT);
  if (!text) return null;
  const validUntil = readOfferDate(source.validUntil);
  if (validUntil && validUntil < today) return null;
  const rawCode = typeof source.code === 'string' ? source.code.trim().toUpperCase() : '';
  return { text, validUntil, code: OFFER_CODE_PATTERN.test(rawCode) ? rawCode : null };
}

/** "Dec 31" from `2026-12-31`, without any timezone conversion. */
export function formatOfferDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${MONTHS[(month ?? 1) - 1]} ${day}`;
}

/** "Until Dec 31", "Code SUMMER10" or both, or null when there is no detail. */
export function offerDetailLine(offer: PosterOffer): string | null {
  const parts = [
    offer.validUntil ? `Until ${formatOfferDate(offer.validUntil)}` : null,
    offer.code ? `Code ${offer.code}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join('. ') : null;
}

/** The create form's offer fields, as typed. */
export type OfferDraft = { text: string; validUntil: string; code: string };

export const EMPTY_OFFER_DRAFT: OfferDraft = { text: '', validUntil: '', code: '' };
