import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import {
  POSTER_ARCHETYPE_FAMILY,
  POSTER_ARCHETYPE_IDS,
  cleanPosterCopy,
  type PosterArchetypeId,
  type PosterCopy,
  type PosterSpec,
  type PosterStyleFamily,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

/**
 * Free, instant edits on a finished post. Every function returns a new spec; the
 * compiler redraws it with no AI call. Limits match the director's, so a typed line
 * can never overflow a layout that the model's copy fits.
 */

/** Copy slots a host can retype, in the order the panel shows them. */
export const QUICK_EDIT_TEXT_SLOTS = [
  { key: 'eyebrow', label: 'Top line', words: 5, chars: 32 },
  { key: 'headline', label: 'Headline', words: 5, chars: 34 },
  { key: 'subhead', label: 'Supporting line', words: 18, chars: 120 },
  { key: 'cta', label: 'Button text', words: 4, chars: 24 },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<PosterCopy, 'chips'>;
  label: string;
  words: number;
  chars: number;
}>;

export type QuickEditTextKey = (typeof QUICK_EDIT_TEXT_SLOTS)[number]['key'];

/** The raw character cap shown on each field (the panel's maxLength). */
export function quickEditCharLimit(key: QuickEditTextKey): number {
  return QUICK_EDIT_TEXT_SLOTS.find((slot) => slot.key === key)!.chars;
}

/**
 * Sets one copy slot. Empty clears optional slots; the headline can never be emptied
 * (it is a fact: the listing name). Over-long text is rejected by returning the spec
 * unchanged, so the caller keeps the previous value instead of silently trimming.
 */
export function setPosterText(spec: PosterSpec, key: QuickEditTextKey, value: string): PosterSpec {
  const slot = QUICK_EDIT_TEXT_SLOTS.find((item) => item.key === key)!;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return key === 'headline' ? spec : { ...spec, copy: { ...spec.copy, [key]: '' } };
  }
  const cleaned = cleanPosterCopy(trimmed, slot);
  if (!cleaned) return spec;
  return { ...spec, copy: { ...spec.copy, [key]: cleaned } };
}

/** Which slots currently fail to normalize (too long), for inline hints. */
export function overLimitSlots(
  draft: Partial<Record<QuickEditTextKey, string>>
): QuickEditTextKey[] {
  return QUICK_EDIT_TEXT_SLOTS.filter((slot) => {
    const value = (draft[slot.key] ?? '').replace(/\s+/g, ' ').trim();
    return value !== '' && cleanPosterCopy(value, slot) === '';
  }).map((slot) => slot.key);
}

export type PosterToggles = Pick<PosterSpec['include'], 'logo' | 'infoBar' | 'location'>;

/** A toggle can only be turned on when the listing has the fact behind it. */
export function setPosterToggle(
  spec: PosterSpec,
  key: keyof PosterToggles,
  on: boolean,
  available: Record<keyof PosterToggles, boolean>
): PosterSpec {
  if (on && !available[key]) return spec;
  return { ...spec, include: { ...spec.include, [key]: on } };
}

/**
 * Puts `url` first (the hero). A photo already on the post moves to the front; a new
 * one is added and the list stays at three (the most any layout places).
 */
export function setHeroPhoto(
  spec: PosterSpec,
  photoUrls: readonly string[],
  url: string
): { spec: PosterSpec; photoUrls: string[] } {
  const current = spec.photoIndexes.map((index) => photoUrls[index]).filter(Boolean) as string[];
  const next = [url, ...current.filter((item) => item !== url)].slice(0, 3);
  return {
    spec: { ...spec, photoIndexes: next.map((_, index) => index) },
    photoUrls: next,
  };
}

/** The hero photo URL of a post, if it has one. */
export function heroPhotoUrl(spec: PosterSpec, photoUrls: readonly string[]): string | null {
  const index = spec.photoIndexes[0];
  return index === undefined ? null : (photoUrls[index] ?? null);
}

/** Switches the layout; in a theme the type stays the theme's. */
export function setPosterLayout(
  spec: PosterSpec,
  archetype: PosterArchetypeId,
  options: { keepFonts?: boolean } = {}
): PosterSpec {
  if (spec.archetype === archetype) return spec;
  return {
    ...spec,
    archetype,
    fontPairing: options.keepFonts ? spec.fontPairing : POSTER_ARCHETYPE_DEFAULT_FONTS[archetype],
  };
}

/** Layouts to offer in the strip: every layout, the current one first, Clean ahead of Flyer. */
export function layoutChoices(current: PosterArchetypeId): PosterArchetypeId[] {
  const order: PosterStyleFamily[] = ['clean', 'lifestyle', 'flyer'];
  const rank = (id: PosterArchetypeId) => order.indexOf(POSTER_ARCHETYPE_FAMILY[id]);
  return [...POSTER_ARCHETYPE_IDS].sort((a, b) => {
    if (a === current) return -1;
    if (b === current) return 1;
    return rank(a) - rank(b);
  });
}

export const POSTER_FAMILY_LABEL: Record<PosterStyleFamily, string> = {
  clean: 'Clean',
  lifestyle: 'Lifestyle',
  flyer: 'Flyer',
};

/** Next layout of the same family not yet used by the conversation ("More like this"). */
export function moreLikeThisLayouts(
  archetype: PosterArchetypeId,
  used: ReadonlySet<string>,
  count: number
): PosterArchetypeId[] {
  const family = POSTER_ARCHETYPE_FAMILY[archetype];
  const pool = POSTER_ARCHETYPE_IDS.filter(
    (id) => id !== archetype && POSTER_ARCHETYPE_FAMILY[id] === family
  );
  const fresh = pool.filter((id) => !used.has(id));
  const rest = pool.filter((id) => used.has(id));
  return [...fresh, ...rest].slice(0, count);
}

export type PostChange = 'text' | 'photo' | 'layout' | 'size' | 'options' | 'style' | 'none';

type PostShape = {
  spec: Record<string, unknown>;
  format: string;
  photoUrls: readonly string[];
};

function heroOf(post: PostShape): string | null {
  const indexes = post.spec.photoIndexes;
  const first = Array.isArray(indexes) ? (indexes[0] as number | undefined) : undefined;
  return first === undefined ? null : (post.photoUrls[first] ?? null);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * What changed between a version and its parent, for the version label. Most specific
 * first; several changes at once read as the first one that applies.
 */
export function describePostChange(parent: PostShape, child: PostShape): PostChange {
  if (parent.format !== child.format) return 'size';
  if (parent.spec.archetype !== child.spec.archetype) return 'layout';
  if (heroOf(parent) !== heroOf(child)) return 'photo';
  if (
    !same(parent.spec.copy, child.spec.copy) ||
    !same(parent.spec.features, child.spec.features)
  ) {
    return 'text';
  }
  if (!same(parent.spec.include, child.spec.include)) return 'options';
  if (!same(parent.spec.palette, child.spec.palette)) return 'style';
  return 'none';
}

export const POST_CHANGE_LABEL: Record<PostChange, string> = {
  text: 'Text edit',
  photo: 'New photo',
  layout: 'New layout',
  size: 'Resized',
  options: 'Options',
  style: 'Style',
  none: 'Copy',
};

export type PosterStyleChoice = 'auto' | PosterStyleFamily;

/** With the new layouts switched off (plan 10.1) every new post uses the original Flyer family. */
export function effectiveStyleChoice(choice: PosterStyleChoice | undefined, v2Enabled: boolean): PosterStyleChoice {
  return v2Enabled ? (choice ?? 'auto') : 'flyer';
}

export const POSTER_STYLE_CHOICES: Array<{ value: PosterStyleChoice; label: string; hint: string }> =
  [
    { value: 'auto', label: 'Auto', hint: 'A mix of looks' },
    { value: 'clean', label: 'Clean', hint: 'Photo first, calm type' },
    { value: 'lifestyle', label: 'Lifestyle', hint: 'Several photos' },
    { value: 'flyer', label: 'Flyer', hint: 'Bold staycation look' },
  ];

/**
 * Steers a batch to one family. Layouts already in the family stay; the others move to
 * the next unused layout of that family, so four posts still differ.
 */
export function applyStyleFamily(
  specs: PosterSpec[],
  choice: PosterStyleChoice,
  options: { keepFonts?: boolean } = {}
): PosterSpec[] {
  if (choice === 'auto') return specs;
  const pool = POSTER_ARCHETYPE_IDS.filter((id) => POSTER_ARCHETYPE_FAMILY[id] === choice);
  const used = new Set(
    specs.filter((spec) => POSTER_ARCHETYPE_FAMILY[spec.archetype] === choice).map((s) => s.archetype)
  );
  return specs.map((spec) => {
    if (POSTER_ARCHETYPE_FAMILY[spec.archetype] === choice) return spec;
    const next = pool.find((id) => !used.has(id)) ?? pool[0]!;
    used.add(next);
    return setPosterLayout(spec, next, options);
  });
}

/** Picked photos lead, then the rest in their ranked order; nothing is duplicated. */
export function orderPhotosWithPicks(photos: readonly string[], picks: readonly string[]): string[] {
  const chosen = picks.filter((url) => photos.includes(url));
  return [...chosen, ...photos.filter((url) => !chosen.includes(url))];
}
