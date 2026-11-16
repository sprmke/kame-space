import { useRef } from 'react';

import { Link } from 'react-router-dom';

import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';

/** Host claims follow `docs/product-positioning.md` (branch `codex/core-product-advantages`) (host advantages 1, 2 and 5). */
const POINTS = [
  'Bookings, guests, rates, and money in one workspace',
  'No commission on direct stay bookings',
  'Airbnb calendar and reservations sync in',
];

/**
 * Closing band for owners. The brand gradient is reserved for this one surface on the page.
 * The mascot stands on the band's bottom edge and rises into place as the band scrolls in.
 */
export function HostBand() {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.95', 'start 0.35'] });
  const eased = useSpring(scrollYProgress, { stiffness: 260, damping: 34, mass: 0.3 });
  const finished = useMotionValue(1);
  const p = reduce ? finished : eased;

  const y = useTransform(p, [0, 1], [72, 0]);
  const rotate = useTransform(p, [0, 1], [6, 0]);
  const glow = useTransform(p, [0, 1], [0.6, 1]);

  return (
    <section aria-labelledby="home-host" className="public-section-y">
      <div className="public-shell">
        <div
          ref={ref}
          className="relative isolate overflow-hidden rounded-3xl bg-[image:var(--brand-gradient)] text-white lg:rounded-[2rem]"
        >
          <div className="grid items-end gap-2 md:grid-cols-12 md:items-center md:gap-6 lg:gap-8">
            <div className="p-6 pb-2 sm:p-10 sm:pb-4 md:col-span-7 md:pb-10 lg:p-14">
              <h2 id="home-host" className="public-section-title text-balance font-semibold">
                Have a unit? Host it on {PLATFORM_APP_NAME}.
              </h2>
              <p className="public-lead mt-2 max-w-xl text-pretty text-white/85">
                List for free and take bookings directly from your guests.
              </p>

              <ul className="mt-5 space-y-2.5 lg:mt-6">
                {POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[15px] leading-snug">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-8">
                <Link
                  to="/for-hosts"
                  className="public-cta text-primary-strong group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 font-semibold outline-none transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                >
                  Become a host
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
                <Link
                  to="/for-hosts/pricing"
                  className="public-cta inline-flex items-center justify-center rounded-full border border-white/40 px-6 font-semibold text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
                >
                  See pricing
                </Link>
              </div>
            </div>

            <div
              aria-hidden
              className="relative flex justify-center md:col-span-5 md:justify-end md:self-end md:pr-6 lg:pr-10"
            >
              <motion.span
                style={{ scale: glow }}
                className="absolute bottom-[-35%] left-1/2 aspect-square w-[80%] max-w-md -translate-x-1/2 rounded-full bg-white/15 md:left-auto md:right-[4%] md:translate-x-0"
              />
              <motion.img
                src="/marketing/home/mascot/dashboard-overview.webp"
                alt=""
                width={448}
                height={468}
                loading="lazy"
                decoding="async"
                style={{ y, rotate }}
                className="relative h-56 w-auto origin-bottom object-contain sm:h-64 lg:h-[21rem]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
