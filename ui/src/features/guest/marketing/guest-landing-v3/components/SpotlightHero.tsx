import { useEffect, useState } from 'react';

import { Link } from 'react-router-dom';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

import { formatPeso } from '@/features/guest/marketing/guest-landing-v3/lib/formatPeso';
import type { PublicPropertyListItem } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { ListingHeroSearch } from '@/features/guest/marketing/shared/components/ListingHeroSearch';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const ROTATE_MS = 7000;
const MAX_SPOTLIGHTS = 4;

type SpotlightHeroProps = {
  stays: PublicPropertyListItem[];
  isLoading: boolean;
};

/**
 * Rounded photo panel of a real stay, with the headline and the app's search on top.
 * The photo slowly rotates through a few recommended stays; the chip links to the one shown.
 */
export function SpotlightHero({ stays, isLoading }: SpotlightHeroProps) {
  const reduceMotion = usePrefersReducedMotion();
  const spotlights = stays.filter((s) => s.images[0]).slice(0, MAX_SPOTLIGHTS);
  const [index, setIndex] = useState(0);
  const current = spotlights.length ? spotlights[index % spotlights.length] : null;

  useEffect(() => {
    if (reduceMotion || spotlights.length < 2) return undefined;
    const t = window.setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [reduceMotion, spotlights.length]);

  return (
    <section className="public-page-top relative z-20 px-4 sm:px-6 lg:px-8">
      <div className="bg-muted relative mx-auto flex min-h-[540px] max-w-7xl flex-col justify-end rounded-3xl sm:min-h-[580px] lg:h-[min(76svh,700px)] lg:rounded-[2rem]">
        {/* Photo layer is clipped on its own so the search dropdown can overflow the panel. */}
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
          <AnimatePresence initial={false}>
            {current ? (
              <motion.div
                key={current.id}
                className="absolute inset-0"
                initial={reduceMotion ? false : { opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: { duration: reduceMotion ? 0 : 1.4, ease: 'easeOut' },
                  scale: { duration: reduceMotion ? 0 : 8, ease: [0.16, 1, 0.3, 1] },
                }}
              >
                <MarketingImage
                  src={current.images[0]}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1280px) 1280px, 100vw"
                  className="object-cover"
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {isLoading && !current ? (
            <div className="bg-muted absolute inset-0 animate-pulse" />
          ) : null}

          {/* Scrim keeps white type at AA over any photo */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10"
          />
        </div>

        {current ? (
          <Link
            to={`/properties/${current.slug}`}
            className="bg-background/95 text-foreground focus-visible:ring-ring absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3 text-sm shadow-[0_6px_20px_-8px_rgba(0,0,0,0.45)] outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 sm:left-6 sm:top-6"
          >
            <span className="relative size-8 shrink-0 overflow-hidden rounded-full">
              <MarketingImage
                src={current.images[0]}
                alt=""
                fill
                sizes="32px"
                className="object-cover"
              />
            </span>
            <span className="min-w-0 truncate">
              <span className="font-semibold">{current.name}</span>
              <span className="text-muted-foreground"> · {formatPeso(current.price)} / night</span>
            </span>
            <ArrowUpRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </Link>
        ) : null}

        {spotlights.length > 1 ? (
          <div className="absolute right-4 top-6 z-10 hidden gap-1.5 sm:right-6 sm:top-9 sm:flex">
            {spotlights.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Show ${s.name}`}
                aria-current={i === index % spotlights.length}
                onClick={() => setIndex(i)}
                className="group relative flex h-6 items-center outline-none"
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full bg-white/50 transition-all duration-300 group-hover:bg-white/80 group-focus-visible:ring-2 group-focus-visible:ring-white',
                    i === index % spotlights.length ? 'w-6 bg-white' : 'w-1.5'
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}

        {/* Copy + search */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 p-5 pt-24 sm:p-8 lg:p-12"
        >
          <h1 className="public-display max-w-[16ch] text-balance font-semibold text-white">
            Condo stays, booked straight from the host
          </h1>
          <p className="public-lead mt-3 max-w-[44ch] text-white/85">
            Find a stay, a residence, or a parking slot close to it.
          </p>
          <div className="mt-6 lg:mt-8">
            <ListingHeroSearch className="mx-0 lg:mx-0" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
