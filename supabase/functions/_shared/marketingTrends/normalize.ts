/**
 * Marketing Trends — title normalization, topic keys and token overlap.
 *
 * Pure. Every source title goes through the same funnel so two spellings of the
 * same thing ("Pinoy Big Brother: Collab 3.0" and "Pinoy Big Brother: Collab
 * Edition 3.0") land on keys that a Jaccard merge can pull together.
 */

import { EVERGREEN_STOPLIST, WIKI_EXACT_STOPLIST, WIKI_NAMESPACE_PREFIXES } from './stoplists.ts';

export type NormalizedTitle = {
  /** Cleaned title in its original casing. Shown to hosts. */
  display: string;
  /** Lowercased, diacritic-free, punctuation-free. Used for matching. */
  normalized: string;
  /** Stable slug. Same topic, same key, across days. */
  key: string;
  /** Content tokens (stop words and very short tokens removed). */
  tokens: string[];
};

/** Placeholder that keeps a decimal point ("3.0") intact through punctuation stripping. */
const DECIMAL_MARK = '\u0001';

/**
 * Parenthetical groups that only disambiguate a Wikipedia-style title.
 * "(TV series)", "(2026)", "(singer)", "(2026 film)".
 */
const DISAMBIGUATOR_WORDS =
  /^(tv|television|series|film|movie|singer|song|album|actor|actress|band|rapper|artist|politician|athlete|player|team|game|magazine|book|footballer|basketball|esports|disambiguation|writer|director|producer|model|host|comedian|volleyball|football)$/;

/** Words that carry no matching signal. */
const TOKEN_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'from',
  'with',
  'that',
  'this',
  'its',
  'into',
  'over',
  'under',
  'about',
  'after',
  'before',
  'more',
  'than',
  'new',
  'ang',
  'mga',
  'ng',
  'sa',
  'ay',
  'ako',
  'nang',
  'para',
  'hindi',
  'may',
  'pero',
  'kapag',
  'habang',
]);

/** Fold accented Latin letters to ASCII. `ñ` → `n`, `é` → `e`. */
export function foldDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Remove `(TV series)`, `(2026)`, `(singer)` and friends from a raw title. */
export function stripDisambiguators(input: string): string {
  return input.replace(/\s*\(([^()]{1,40})\)/g, (match, inner: string) => {
    const content = inner.trim().toLowerCase();
    if (!content) return match;
    if (/^\d{4}$/.test(content)) return '';
    if (/^\d{4}\s+\w+$/.test(content)) return '';
    const words = content.split(/\s+/);
    if (words.length <= 3 && words.some((word) => DISAMBIGUATOR_WORDS.test(word))) return '';
    return match;
  });
}

/**
 * Fold a title to its comparable form: lowercase, diacritics gone, punctuation
 * to spaces, "3.0" kept as one token.
 */
export function normalizeTitle(raw: string): string {
  const cleaned = stripDisambiguators(raw.replace(/_/g, ' '));
  const protectedDecimals = cleaned.replace(/(\d)\.(\d)/g, `$1${DECIMAL_MARK}$2`);
  const folded = foldDiacritics(protectedDecimals).toLowerCase();
  const spaced = folded
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(DECIMAL_MARK)
    .join('.')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced;
}

/** Slug form of a normalized title. */
export function topicKeyFromNormalized(normalized: string): string {
  return normalized
    .replace(/\./g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Content tokens of a normalized title. */
export function tokenize(normalized: string): string[] {
  const tokens: string[] = [];
  for (const raw of normalized.split(' ')) {
    if (!raw) continue;
    const token = raw.replace(/\.$/, '');
    if (token.length < 3) continue;
    if (TOKEN_STOPWORDS.has(token)) continue;
    tokens.push(token);
  }
  return tokens;
}

/** Jaccard similarity of two token lists. 0 when either is empty. */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  const union = setA.size + setB.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** True when a normalized title is an index page or an evergreen term. */
export function isStoplistedTitle(normalized: string): boolean {
  if (!normalized) return true;
  if (WIKI_EXACT_STOPLIST.includes(normalized)) return true;
  if (EVERGREEN_STOPLIST.includes(normalized)) return true;
  for (const prefix of WIKI_NAMESPACE_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix} `)) return true;
  }
  return false;
}

/** Full normalization of one raw source title. */
export function normalizeRawTitle(raw: string): NormalizedTitle {
  const display = stripDisambiguators(raw.replace(/_/g, ' ')).replace(/\s+/g, ' ').trim();
  const normalized = normalizeTitle(raw);
  return {
    display,
    normalized,
    key: topicKeyFromNormalized(normalized),
    tokens: tokenize(normalized),
  };
}

/** Two normalized titles are probably the same topic. */
export function titlesOverlap(a: NormalizedTitle, b: NormalizedTitle): boolean {
  if (a.key === b.key) return true;
  return jaccard(a.tokens, b.tokens) >= 0.6;
}
