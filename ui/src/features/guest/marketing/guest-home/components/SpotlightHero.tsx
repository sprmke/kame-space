import { motion } from 'framer-motion';

import {
  HERO_IMAGE_DARK,
  HERO_IMAGE_HEIGHT,
  HERO_IMAGE_LIGHT,
  HERO_IMAGE_WIDTH,
} from '@/features/guest/marketing/guest-home/lib/themeHeroTransition';
import { ListingHeroSearch } from '@/features/guest/marketing/shared/components/ListingHeroSearch';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { STATIC_PAGE_COPY } from '@/lib/seo/content/staticPageCopy';

/**
 * Full-bleed theme art.
 *
 * The hero is the LCP element on `/`, so the width matters: pre-rendered variants let the
 * browser pick by viewport (27 KB at 480w instead of the full render). AVIF is roughly half
 * the WebP at the same width and is offered first; WebP covers browsers without AVIF, and the
 * JPEG is the last fallback for old WebViews. Regenerate with
 * `node scripts/media/generate-hero-variants.mjs`.
 */
const HERO_WIDTHS = [480, 800, 1200] as const;
const HERO_SIZES = '(min-width: 1280px) 1280px, 100vw';

/**
 * Hero art sits behind the headline and the search. The day render is the one that paints
 * first, so it carries the description; the night layer is the same scene for the other theme
 * and stays decorative so a screen reader hears it once.
 */
const HERO_ART_ALT = 'Sunlit living room in a Kame Space stay, looking out to the water';

function HeroArt({
  src,
  priority,
  decorative = false,
}: {
  src: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  const shared = {
    alt: decorative ? '' : HERO_ART_ALT,
    width: HERO_IMAGE_WIDTH,
    height: HERO_IMAGE_HEIGHT,
    sizes: HERO_SIZES,
    className: 'absolute inset-0 h-full w-full object-cover object-[50%_45%]',
  };
  const webpSrcSet = HERO_WIDTHS.map((width) => `${src}-${width}.webp ${width}w`).join(', ');
  const avifSrcSet = HERO_WIDTHS.map((width) => `${src}-${width}.avif ${width}w`).join(', ');
  return (
    <picture>
      <source srcSet={avifSrcSet} sizes={HERO_SIZES} type="image/avif" />
      <source srcSet={webpSrcSet} sizes={HERO_SIZES} type="image/webp" />
      <MarketingImage {...shared} src={`${src}.jpg`} priority={priority} />
    </picture>
  );
}

/**
 * Rounded photo panel with the headline and the app's search on top.
 * Both theme renders are stacked and the night layer dissolves over the day layer when the
 * theme changes. No zoom or pan: the renders share a frame, so the dissolve is the whole
 * transition. Reduced motion swaps with no animation (see `.hero-theme-layer` in index.css).
 */
export function SpotlightHero() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <section className="public-page-top public-shell relative z-20">
      <div className="bg-muted relative flex min-h-[540px] flex-col justify-end rounded-3xl sm:min-h-[580px] lg:h-[min(76svh,700px)] lg:rounded-[2rem]">
        {/* Photo layer is clipped on its own so the search dropdown can overflow the panel. */}
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
          <div className="hero-theme-layer hero-theme-layer--light absolute inset-0">
            <HeroArt src={HERO_IMAGE_LIGHT} priority />
          </div>
          <div className="hero-theme-layer hero-theme-layer--dark absolute inset-0">
            <HeroArt src={HERO_IMAGE_DARK} decorative />
          </div>

          {/* Legibility scrim. The sunrise render already has a strong dark vignette on its
              left edge, so a full-panel black wash stacked a second pass on top and read as a
              wall of paint against the light page. Two targeted layers instead: a gentle bottom
              gradient for the search bar, and a diagonal corner shade that sits only behind the
              headline. The right side of the photo stays bright. */}
          <div aria-hidden className="hero-scrim-base absolute inset-0" />
          <div aria-hidden className="hero-scrim-copy absolute inset-0" />
        </div>

        {/* Copy + search */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 p-5 pt-24 sm:p-8 lg:p-12"
        >
          <h1 className="public-display hero-copy max-w-[16ch] text-balance font-semibold text-white">
            {STATIC_PAGE_COPY.home.heading}
          </h1>
          <p className="public-lead hero-copy mt-3 max-w-[34ch] text-pretty text-white/95">
            {STATIC_PAGE_COPY.home.intro}
          </p>
          <div className="mt-6 lg:mt-8">
            <ListingHeroSearch className="mx-0 lg:mx-0" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
