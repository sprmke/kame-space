/**
 * Marketing Trends — stoplists.
 *
 * Three jobs:
 *  - Drop Wikimedia namespace and index pages (they are never a topic).
 *  - Drop evergreen terms that are "always trending" and say nothing about today.
 *  - Drop the Tagalog Wikipedia namespaces that behave like index pages.
 */

import type { TrendSourceId } from './types.ts';

/**
 * Wikimedia namespace prefixes. `Natatangi:` and `Unang_Pahina` are the Tagalog
 * equivalents of "Special:" and "Main Page" and rank high every day.
 */
export const WIKI_NAMESPACE_PREFIXES: readonly string[] = [
  'special',
  'wikipedia',
  'portal',
  'file',
  'help',
  'template',
  'category',
  'talk',
  'user',
  'draft',
  'mediawiki',
  'module',
  'book',
  'wikipedia talk',
  'natatangi',
  'unang pahina',
  'mga espesyal',
];

/** Page names that are never a topic, in any casing. */
export const WIKI_EXACT_STOPLIST: readonly string[] = [
  'main page',
  'mainpage',
  'home',
  'unang pahina',
  'wikipedia',
  'philippines',
  'filipino people',
  'tagalog people',
];

/**
 * Terms that are trending every single day. They carry no signal about *today*,
 * so they are dropped before scoring. Kept small and specific on purpose.
 */
export const EVERGREEN_STOPLIST: readonly string[] = [
  'philippines',
  'philippine',
  'manila',
  'metro manila',
  'google',
  'youtube',
  'facebook',
  'instagram',
  'tiktok',
  'whatsapp',
  'chatgpt',
  'wikipedia',
  'wikipedia',
  'deaths in 2026',
  'deaths in 2025',
  'deaths in 2024',
  'list of',
  'philippine peso',
  'pilipinas',
];

/**
 * Sources whose titles are news-like, so the deterministic keyword denylist
 * applies to them. Music and video titles often contain a blocked word by
 * accident (the OPM song "Ako ang bagyo", the film "Surviving Hurricane Otis"),
 * so those sources skip the denylist and rely on the AI safety pass instead.
 */
export const NEWS_DERIVED_SOURCES: readonly TrendSourceId[] = [
  'google_trends',
  'wikimedia_ph',
  'wikimedia_tl',
];
