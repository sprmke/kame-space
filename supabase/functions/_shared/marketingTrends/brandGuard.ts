/**
 * Marketing Trends — brand-safety guard on generated copy.
 *
 * A host may reference a trending topic, never a person or a brand. The prompt
 * rules ask the model to avoid endorsement wording; this module is the
 * deterministic check that catches what slips past the model. A rejected variant
 * is dropped (posters already drop failed variants) and a caption is regenerated
 * once.
 *
 * Plan §4.6.
 */

import type { TrendCategory } from './types.ts';

/** Guard rules stored on a topic and injected into the generation prompt. */
export const BRAND_GUARD_RULES = ['no_likeness', 'no_logo', 'no_endorsement'] as const;

export type BrandGuardRule = (typeof BRAND_GUARD_RULES)[number];

/** Categories where a name, a face or a logo could end up in the copy. */
const PEOPLE_ADJACENT_CATEGORIES: readonly TrendCategory[] = ['celebrity', 'tv_film', 'music'];

/** True when the topic's category needs the brand guard. */
export function needsBrandGuard(category: TrendCategory): boolean {
  return PEOPLE_ADJACENT_CATEGORIES.includes(category);
}

/** The guard rules for a category. Always all three for people-adjacent topics. */
export function guardRulesForCategory(category: TrendCategory): BrandGuardRule[] {
  return needsBrandGuard(category) ? [...BRAND_GUARD_RULES] : [];
}

/**
 * Capitalized words that are not a person's name. Without this list,
 * "Stay with Weekend Plans" would read as a partnership with a person.
 */
const NOT_A_NAME = new Set([
  'a',
  'an',
  'and',
  'at',
  'best',
  'christmas',
  'city',
  'day',
  'days',
  'good',
  'home',
  'in',
  'new',
  'night',
  'our',
  'on',
  'plan',
  'plans',
  'pool',
  'room',
  'stay',
  'staycation',
  'summer',
  'the',
  'time',
  'to',
  'today',
  'town',
  'view',
  'week',
  'weekend',
  'year',
]);

/** "Alexandra Eala" reads as a person name; "Weekend Plans" does not. */
function looksLikeAPersonName(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  for (const word of words) {
    if (!/^[A-Z][a-z]+$/.test(word)) return false;
    if (NOT_A_NAME.has(word.toLowerCase())) return false;
  }
  return true;
}

/**
 * Endorsement wording. A host may say "watching PBB tonight", never "official
 * PBB" or "with Alexandra Eala".
 */
const ENDORSEMENT_PATTERNS: Array<{ rule: BrandGuardRule; pattern: RegExp }> = [
  { rule: 'no_endorsement', pattern: /\bofficial\s+(?:partner|store|site|page)\b/i },
  { rule: 'no_endorsement', pattern: /\bofficial\b/i },
  { rule: 'no_endorsement', pattern: /\bsponsored\s+by\b/i },
  { rule: 'no_endorsement', pattern: /\b(?:in|official)\s+partnership\s+with\b/i },
  { rule: 'no_endorsement', pattern: /\bendorsed\s+by\b/i },
  { rule: 'no_endorsement', pattern: /\bpartnered\s+with\b/i },
  { rule: 'no_endorsement', pattern: /\bambassador\s+for\b/i },
  { rule: 'no_endorsement', pattern: /\bbrand\s+ambassador\b/i },
  { rule: 'no_likeness', pattern: /\b[Mm]eet\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/ },
  { rule: 'no_likeness', pattern: /\b[Ww]ith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/ },
  {
    rule: 'no_likeness',
    pattern: /\b(?:[Ff]eaturing|[Ss]tarring)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
  },
  { rule: 'no_logo', pattern: /\b(?:logo|brand mark|trademark)\b/i },
];

/**
 * The first guard rule the text breaks, or null when the text is clean.
 * Only people-adjacent categories are checked.
 */
export function findBrandGuardViolation(
  text: string,
  category: TrendCategory
): BrandGuardRule | null {
  if (!text) return null;
  if (!needsBrandGuard(category)) return null;
  for (const { rule, pattern } of ENDORSEMENT_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    // The name-shaped rules only fire on something that reads like a person.
    if (rule === 'no_likeness') {
      const name = match[1] ?? '';
      if (!looksLikeAPersonName(name)) continue;
    }
    return rule;
  }
  return null;
}

/** True when the text breaks no guard rule for that category. */
export function isBrandSafe(text: string, category: TrendCategory): boolean {
  return findBrandGuardViolation(text, category) === null;
}

/** The prompt block appended when a topic has guard rules. */
export function buildBrandGuardPromptBlock(rules: readonly string[]): string {
  if (!rules.length) return '';
  const lines: string[] = [];
  if (rules.includes('no_endorsement')) {
    lines.push(
      '- Do not use endorsement wording: no "official", "sponsored", "partnered with", "endorsed by", or "in partnership with".'
    );
  }
  if (rules.includes('no_likeness')) {
    lines.push(
      '- Do not use a real person’s name as if they are part of the stay, and do not say "meet" or "with" followed by a person’s name.'
    );
  }
  if (rules.includes('no_logo')) {
    lines.push(
      '- Do not use show, network, team or brand logos, and do not write brand names into the copy.'
    );
  }
  if (!lines.length) return '';
  return `\nBrand rules for this topic:\n${lines.join('\n')}`;
}
