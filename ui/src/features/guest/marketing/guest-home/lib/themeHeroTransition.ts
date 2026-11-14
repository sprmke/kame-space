/** Home hero art per theme. Light = sunrise render, dark = night render. */
export const HERO_IMAGE_LIGHT = '/marketing/home/hero-day';
export const HERO_IMAGE_DARK = '/marketing/home/hero-night';

/**
 * Intrinsic size of both renders. They share the same frame, so the crossfade lines the
 * towers and horizon up exactly instead of sliding between two different crops.
 *
 * Keep in sync with `ui/public/marketing/home/hero-*.jpg` and the widths in
 * `scripts/media/generate-hero-variants.mjs`.
 */
export const HERO_IMAGE_WIDTH = 1672;
export const HERO_IMAGE_HEIGHT = 941;
