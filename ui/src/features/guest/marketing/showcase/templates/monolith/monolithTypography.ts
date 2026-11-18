/**
 * Monolith display sizes — fluid clamps anchored to 16px body (`text-base`). Instrument Serif is
 * a condensed face, so each step runs about one size up from a regular serif to hold its hierarchy.
 * Scales with editor **Scale** via `--showcase-display-scale` on `.showcase-scope`.
 *
 * Every class below is a complete literal on purpose: Tailwind's scanner cannot see a class built
 * with `${}`, so an interpolated version never produced CSS and the titles fell back to ~24px.
 */

/** Template display face — Instrument Serif for hero/section titles (not editor Cormorant). */
export const monolithDisplayFontClass = 'font-instrument';

/** Header chrome — clean sans for brand + nav (consistent, readable at small sizes). */
export const monolithHeaderChromeClass = 'font-sans antialiased';

export const monolithHeroTitleClass = [
  'text-[length:calc(clamp(2.5rem,1.9rem_+_3vw,3.5rem)*var(--showcase-display-scale,1))]',
  '@md:text-[length:calc(clamp(3rem,1.5rem_+_4vw,4.5rem)*var(--showcase-display-scale,1))]',
  '@lg:text-[length:calc(clamp(3.5rem,1.5rem_+_3.4vw,5.25rem)*var(--showcase-display-scale,1))]',
  'leading-[1.02] tracking-[-0.03em]',
].join(' ');

export const monolithSectionTitleClass = [
  'text-[length:calc(clamp(1.875rem,1.5rem_+_1.6vw,2.25rem)*var(--showcase-display-scale,1))]',
  '@md:text-[length:calc(clamp(2.125rem,1.4rem_+_1.6vw,2.75rem)*var(--showcase-display-scale,1))]',
  '@lg:text-[length:calc(clamp(2.5rem,1.5rem_+_1.6vw,3.25rem)*var(--showcase-display-scale,1))]',
  'leading-tight tracking-tight',
].join(' ');

export const monolithStatValueClass = [
  'text-[length:calc(clamp(1.875rem,1.4rem_+_1.8vw,2.5rem)*var(--showcase-display-scale,1))]',
  '@md:text-[length:calc(clamp(2.25rem,1.5rem_+_1.5vw,3rem)*var(--showcase-display-scale,1))]',
  'leading-tight tracking-tight',
].join(' ');

export const monolithBrandTitleClass =
  'font-sans text-sm font-medium tracking-normal @sm:text-base';
