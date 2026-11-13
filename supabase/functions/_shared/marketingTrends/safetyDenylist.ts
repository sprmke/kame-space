/**
 * Marketing Trends — deterministic safety denylist.
 *
 * A fast pre-filter that runs before the AI classify pass on news-derived
 * sources only (Google Trends, Wikimedia). It never replaces the AI pass; the AI
 * pass judges the *topic*, this one drops the obvious ones in milliseconds.
 *
 * Matching is on whole words and whole phrases so "award" never matches "war"
 * and "huling" never matches "huli".
 */

/**
 * Single words. Matched as whole tokens only.
 *
 * Note on "huli": the plan listed it as a holdup term, but standalone "huli" is
 * ordinary Filipino for "last" ("Huling Biyahe" is a common movie title), so it
 * is not blocked here. The crime is caught by "holdup" / "pang-holdup" instead,
 * and the AI pass still judges every topic on its own merits.
 */
export const UNSAFE_WORDS: readonly string[] = [
  // Death and harm
  'death',
  'deaths',
  'died',
  'dies',
  'dead',
  'killed',
  'kills',
  'murder',
  'murdered',
  'suicide',
  'funeral',
  'corpse',
  'massacre',
  'fatal',
  'fatality',
  'fatalities',
  'accident',
  'accidental',
  'casualty',
  'casualties',
  'shooting',
  'stabbed',
  'hijack',
  'bombing',
  'bombed',
  'explosion',
  // Filipino
  'namatay',
  'patay',
  'nasawi',
  'biktima',
  'aksidente',
  'disaster',
  // Crime and law
  'crime',
  'criminal',
  'arrest',
  'arrested',
  'jailed',
  'custody',
  'prosecut',
  'prosecutor',
  'rape',
  'assault',
  'abuse',
  'hazing',
  'hostage',
  'holdup',
  'kidnap',
  'scam',
  'scams',
  'scammed',
  'fraud',
  'fraudulent',
  'theft',
  'stolen',
  'burglary',
  'drugs',
  'druglord',
  'illegal',
  // Filipino
  'huli at',
  'panghholdup',
  'pang-holdup',
  'hold-up',
  'kulong',
  'nabakwit',
  'panloloko',
  // Disasters and weather
  'earthquake',
  'aftershock',
  'typhoon',
  'hurricane',
  'flood',
  'flooding',
  'landslide',
  'storm',
  'volcano',
  'eruption',
  'tsunami',
  'drought',
  'wildfire',
  'forest fire',
  // Filipino
  'bagyo',
  'lindol',
  'sunog',
  'bumpa',
  'sigorta',
  // Politics and government
  'election',
  'elections',
  'voter',
  'vote',
  'ballot',
  'poll',
  'president',
  'vice president',
  'senator',
  'senate',
  'congress',
  'congressman',
  'impeach',
  'impeachment',
  'coup',
  'politician',
  'political',
  'parliament',
  'governor',
  'mayor',
  'corruption',
  'protest',
  'protesters',
  'riot',
  'military',
  'soldier',
  'troops',
  'ceasefire',
  'militia',
  // Health emergencies
  'outbreak',
  'pandemic',
  'epidemic',
  'quarantine',
  'lockdown',
  'cholera',
  'dengue',
  'measles',
  'covid',
  // Gambling
  'lotto',
  'lottery',
  'jackpot',
  'roulette',
  'gambling',
  'casino',
  'betting',
  'bets',
  'sweepstakes',
  'illegal gambling',
  // Data and tech failures
  'data breach',
  'breach',
  'hacked',
  'hack',
  'ransomware',
  'malware',
  'phishing',
  'identity theft',
  'data leak',
  // Economy
  'stagflation',
  'inflation',
  'recession',
  'layoff',
  'layoffs',
  'job cuts',
  // Scandals and crime news
  'scandal',
  'controversy',
  'backlash',
  'misconduct',
  'abuse of power',
  'drug charge',
  'drug trade',
  'human trafficking',
  'drug war',
  'drug kill',
];

/**
 * Multi-word phrases. Matched before the single-word list so a phrase is never
 * split by the tokenizer.
 */
export const UNSAFE_PHRASES: readonly string[] = [
  'missing person',
  'missing girl',
  'missing boy',
  'found dead',
  'went missing',
  'under investigation',
  'investigation finds',
  'filed charges',
  'filed case',
  'rape case',
  'drug raid',
  'drug bust',
  'crash lands',
  'plane crash',
  'train collision',
  'building collapse',
  'magnitude',
  'death toll',
  'casualties reported',
  'state of emergency',
  'class 1 typhoon',
  'typhoon signal',
  'signal number',
  'evacuation order',
  'state of war',
  'world war',
  'civil war',
  'extreme weather',
  'heat index',
  'air quality',
  'poll results',
  'vote count',
  'coup attempt',
  'state of emergency',
  'covid cases',
  'virus outbreak',
  'swine flu',
  'avian flu',
  'data leak',
  'data breach',
  'hacked account',
  'phishing scam',
  'investment scam',
  'employment scam',
  'drug lords',
  'drug lord',
  'drug trade',
  'illegal drugs',
  'human trafficking',
  'drug war',
  'drug kill',
];

/** Normalized text is already lowercased and space-separated, so a plain word test works. */
function isWholeWord(haystack: string, word: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(word, from);
    if (at === -1) return false;
    const before = at === 0 ? ' ' : haystack[at - 1]!;
    const after = at + word.length >= haystack.length ? ' ' : haystack[at + word.length]!;
    if (!isWordChar(before) && !isWordChar(after)) return true;
    from = at + 1;
  }
}

function isWordChar(char: string): boolean {
  return /[a-z0-9]/.test(char);
}

/** The first unsafe term found, or null. Uses the normalized (folded) text. */
export function findUnsafeTerm(normalizedText: string): string | null {
  const haystack = ` ${normalizedText.replace(/\s+/g, ' ').trim()} `;
  for (const phrase of UNSAFE_PHRASES) {
    if (haystack.includes(` ${phrase} `)) return phrase;
  }
  for (const word of UNSAFE_WORDS) {
    if (word.includes(' ')) {
      if (haystack.includes(` ${word} `)) return word;
      continue;
    }
    if (isWholeWord(haystack, word)) return word;
  }
  return null;
}

/** True when the normalized title contains a blocked term. */
export function isDeterministicallyUnsafe(normalizedText: string): boolean {
  return findUnsafeTerm(normalizedText) !== null;
}
