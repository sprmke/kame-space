/**
 * Deterministic safety guard for guest-facing inbox AI replies.
 */

export type GuardResult = { safe: true } | { safe: false; reason: string };

export type GuestInquiryIntent = 'normal' | 'sensitive';

export type GuestReplyGuardInput = {
  draftText: string;
  guestMessage?: string | null;
  allowedFacts: {
    pricingValues: number[];
    allowedAccountNumbers?: string[];
    /** Known-facts text the reply was grounded on; numbers appearing here are grounded. */
    factsText?: string;
  };
  participantName?: string | null;
  otherGuestNames?: string[];
};

export const AI_SUGGEST_FALLBACK_REPLY = 'Let me check on that and get back to you shortly.';

const OWNER_SENSITIVE_TOPIC_PATTERN =
  /\b(revenue|expenses?|profit|net income|payroll|salary|maintenance schedule|maintenance item|internal note|internal only|telegram|bot token|api[_ ]?key|password|secret|service[_ ]?role|refresh token|gmail)\b/i;

const SENSITIVE_GUEST_REQUEST_PATTERN =
  /\b(other guests?|guest list|who (?:else )?(?:is|are) (?:staying|booked|checking in)|who booked|name of (?:the )?guest|booked on|my revenue|your revenue|how much (?:do you|you) (?:earn|make)|profit margin|finance report|owner earnings|internal ops|telegram bot)\b/i;

const NORMAL_GUEST_TOPIC_PATTERN =
  /\b(available|availability|today|tonight|rate|price|pricing|payment|gcash|cash|cancel|cancellation|refund|address|location|map|tower|floor|residence|unit|amenit|wifi|parking|pet|check[- ]?in|check[- ]?out|book|booking|how to pay|payment method)\b/i;

const CURRENCY_AMOUNT_PATTERN =
  /(?:₱|PHP\s*|P\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;

/** Amounts written without a currency prefix: "3,500 pesos", "2500/night", "1,800 per night". */
const BARE_AMOUNT_PATTERN =
  /\b(\d{1,3}(?:,\d{3})+|\d{3,6})(?:\.\d{1,2})?\s*(?:pesos?\b|php\b|\/\s*(?:night|nt)\b|per\s+(?:night|stay|person|guest|pax)\b)/gi;

/** Long digit runs (GCash / bank / card numbers) — must be a configured account or in the facts.
 * Dots, spaces, dashes and parentheses are accepted separators so `0917.555.1234`,
 * `0917 555 1234` and `(0917) 555-1234` are all caught; a formatted number must not
 * slip past the guard just because the model grouped the digits differently. */
const ACCOUNT_NUMBER_PATTERN = /\+?\d[\d\s().-]{8,}\d/g;

/**
 * A finance figure that follows an owner/internal term, even inside a reply that also
 * contains a refusal phrase ("I can't share that, but revenue was 1M"). The refusal must
 * not whitelist the leak that follows it.
 */
const FINANCE_TERM_NEAR_FIGURE_PATTERN =
  /\b(revenue|profit|expenses?|net income|earnings?|payouts?|gross margin|profit margin)\b[^.!?\n]{0,60}?(?:₱|PHP\b|P\s?\d|\d{1,3}\s?%|\d[\d,]{2,})/i;

/**
 * A model reply can exfiltrate context through a rendered link or image: markdown is turned
 * into a clickable URL, and some clients prefetch images. Only links the platform itself owns
 * (plus map directions) are allowed; a `data:` or script URI is never safe.
 */
const ALLOWED_REPLY_LINK_HOSTS: RegExp[] = [
  /^kamespace\.com$/i,
  /\.kamespace\.com$/i,
  /^maps\.google\.com$/i,
  /^maps\.app\.goo\.gl$/i,
  /^goo\.gl$/i,
  /^waze\.com$/i,
  /^openstreetmap\.org$/i,
  /\.openstreetmap\.org$/i,
  /\.supabase\.co$/i,
];

const REPLY_LINK_PATTERN = /(?:https?:\/\/|\/\/|www\.)[^\s<>"')\]]+/gi;
const SCRIPT_OR_DATA_URI_PATTERN = /\b(?:data|javascript|vbscript):/i;

/** First URL in the draft that is not a platform or map link, or a script/data URI. */
export function findUnsafeReplyLink(text: string): string | null {
  if (SCRIPT_OR_DATA_URI_PATTERN.test(text)) return 'script or data URI';
  for (const match of text.matchAll(REPLY_LINK_PATTERN)) {
    const raw = match[0].replace(/[.,;:!?]+$/, '');
    let host: string;
    try {
      host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
    } catch {
      return raw;
    }
    if (!ALLOWED_REPLY_LINK_HOSTS.some((pattern) => pattern.test(host))) return raw;
  }
  return null;
}

function normalizeAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeAccountDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function amountsClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function classifyGuestInquiryIntent(
  guestMessage: string | null | undefined
): GuestInquiryIntent {
  const text = String(guestMessage ?? '').trim();
  if (!text) return 'normal';
  if (SENSITIVE_GUEST_REQUEST_PATTERN.test(text)) return 'sensitive';
  if (NORMAL_GUEST_TOPIC_PATTERN.test(text)) return 'normal';
  return 'normal';
}

function draftAppropriatelyRefusesSensitive(draftText: string): boolean {
  return /\b(cannot share|can't share|not able to share|unable to share|for privacy|host team|check with (?:the )?host|I'?ll check with)\b/i.test(
    draftText
  );
}

function extractDraftAmounts(draftText: string): number[] {
  const amounts: number[] = [];
  for (const pattern of [CURRENCY_AMOUNT_PATTERN, BARE_AMOUNT_PATTERN]) {
    for (const match of draftText.matchAll(pattern)) {
      const raw = match[1]?.replace(/,/g, '');
      if (!raw) continue;
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) amounts.push(normalizeAmount(parsed));
    }
  }
  return amounts;
}

/** A long digit run that is neither a configured payment account nor present in the facts. */
function findUngroundedAccountNumber(
  draftText: string,
  allowedAccountNumbers: string[],
  factsText: string
): string | null {
  const allowed = new Set(allowedAccountNumbers.map(normalizeAccountDigits).filter(Boolean));
  const factsDigits = normalizeAccountDigits(factsText);
  for (const match of draftText.matchAll(ACCOUNT_NUMBER_PATTERN)) {
    const digits = normalizeAccountDigits(match[0]);
    if (digits.length < 10) continue;
    if (allowed.has(digits)) continue;
    if (factsDigits.includes(digits)) continue;
    return match[0].trim();
  }
  return null;
}

function isAllowedAmount(amount: number, allowedValues: number[]): boolean {
  const normalizedAllowed = allowedValues.map(normalizeAmount);
  if (normalizedAllowed.some((allowed) => amountsClose(amount, allowed))) {
    return true;
  }
  return normalizedAllowed.some((allowed) => Math.abs(amount - allowed) <= 5);
}

/**
 * Name tokens too common in ordinary guest-facing copy to treat as a leak: number words (any
 * reply naming a count, a date, or a time uses these) plus other single-token words that collide
 * with everyday vocabulary. `otherGuestNames` is built from individual name parts split off a
 * full name (`splitGuestNames`), so a surname like "King" or "One" shows up here as its own
 * token — reproduced live: "Yes, parking is available..." flagged on "King" (inside "parking"),
 * and "Kit One" / "Val Two" flag almost any reply that mentions a time or a count.
 */
const COMMON_WORD_NAME_STOPLIST = new Set([
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
]);

function containsOtherGuestName(
  draftText: string,
  participantName: string | null | undefined,
  otherGuestNames: string[]
): string | null {
  if (otherGuestNames.length === 0) return null;

  const draftLower = draftText.toLowerCase();
  const participantTokens = new Set(
    String(participantName ?? '')
      .split(/[\s,/&]+/)
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length >= 2)
  );

  for (const name of otherGuestNames) {
    const trimmed = name.trim();
    if (trimmed.length < 3) continue;
    const lower = trimmed.toLowerCase();
    if (participantTokens.has(lower)) continue;
    if (COMMON_WORD_NAME_STOPLIST.has(lower)) continue;
    // Word-boundary, not a raw substring match — "king" must not match inside "parking".
    const pattern = new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (pattern.test(draftLower)) {
      return trimmed;
    }
  }

  return null;
}

function draftSharesOwnerSensitiveTopic(draftText: string): boolean {
  return (
    OWNER_SENSITIVE_TOPIC_PATTERN.test(draftText) && !draftAppropriatelyRefusesSensitive(draftText)
  );
}

export function assertSafeGuestReply(input: GuestReplyGuardInput): GuardResult {
  const draftText = input.draftText.trim();
  if (!draftText) {
    return { safe: false, reason: 'empty reply' };
  }

  const intent = classifyGuestInquiryIntent(input.guestMessage);

  const unsafeLink = findUnsafeReplyLink(draftText);
  if (unsafeLink) {
    return { safe: false, reason: `external link: ${unsafeLink.slice(0, 80)}` };
  }

  const leakedGuest = containsOtherGuestName(
    draftText,
    input.participantName,
    input.otherGuestNames ?? []
  );
  if (leakedGuest) {
    return { safe: false, reason: `other guest name: ${leakedGuest}` };
  }

  if (draftSharesOwnerSensitiveTopic(draftText)) {
    return { safe: false, reason: 'owner/internal sensitive topic in reply' };
  }

  // A refusal phrase at the start of a sentence does not make a figure after it safe:
  // "I can't share that, but our revenue was PHP 1,000,000" still leaks the number.
  if (FINANCE_TERM_NEAR_FIGURE_PATTERN.test(draftText)) {
    return { safe: false, reason: 'sensitive finance figure in reply' };
  }

  if (intent === 'sensitive') {
    if (draftAppropriatelyRefusesSensitive(draftText)) {
      return { safe: true };
    }
    if (/\b(revenue|profit|expenses?|net income)\b/i.test(draftText)) {
      return { safe: false, reason: 'sensitive inquiry answered with finance data' };
    }
  }

  // An invented GCash / bank number would send a guest's money to the wrong place.
  const strayAccount = findUngroundedAccountNumber(
    draftText,
    input.allowedFacts.allowedAccountNumbers ?? [],
    input.allowedFacts.factsText ?? ''
  );
  if (strayAccount) {
    return { safe: false, reason: 'ungrounded account number' };
  }

  const draftAmounts = extractDraftAmounts(draftText);
  if (draftAmounts.length > 0 && input.allowedFacts.pricingValues.length === 0) {
    return { safe: false, reason: 'pricing mentioned without grounded facts' };
  }

  for (const amount of draftAmounts) {
    if (!isAllowedAmount(amount, input.allowedFacts.pricingValues)) {
      return { safe: false, reason: `ungrounded amount: ${amount}` };
    }
  }

  return { safe: true };
}
