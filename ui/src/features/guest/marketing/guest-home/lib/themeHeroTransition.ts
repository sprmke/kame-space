/** Home hero art per theme. Light = sunrise render, dark = night render. */
export const HERO_IMAGE_LIGHT = '/marketing/home/hero-day';
export const HERO_IMAGE_DARK = '/marketing/home/hero-night';

/**
 * Intrinsic size of both renders. They share the same frame, so the crossfade lines the
 * towers and horizon up exactly instead of sliding between two different crops.
 *
 * Derived from the hero art after `bun run images:optimize` resized it to 1400px wide for
 * weight. Keep these in sync with `ui/public/marketing/home/hero-*`.
 */
export const HERO_IMAGE_WIDTH = 1400;
export const HERO_IMAGE_HEIGHT = 788;
