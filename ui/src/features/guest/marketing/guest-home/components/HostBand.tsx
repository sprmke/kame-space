import { Link } from 'react-router-dom';

import { ArrowRight, Check } from 'lucide-react';

import { KameMascotImage } from '@/components/branding/KameMascotImage';

const HOST_FACTS = ['Free to start', 'No cut per booking', 'One stay workflow'] as const;

/**
 * Closing band for owners on the guest explore home.
 * Compact take on the for-hosts closing CTA: solid brand panel, short copy, mascot.
 */
export function HostBand() {
  return (
    <section aria-labelledby="home-host" className="public-section-y">
      <div className="public-shell">
        <div className="bg-primary-strong text-primary-foreground relative overflow-hidden rounded-3xl shadow-[0_28px_70px_-40px_hsl(var(--primary))] lg:rounded-[1.75rem]">
          <div
            className="pointer-events-none absolute -right-16 -top-28 size-[22rem] rounded-full border-[56px] border-white/5 sm:size-[26rem] sm:border-[64px]"
            aria-hidden
          />
          <div
            className="bg-primary/20 pointer-events-none absolute -bottom-40 left-1/4 size-[18rem] rounded-full blur-3xl"
            aria-hidden
          />

          <div className="relative flex min-h-[17rem] flex-col sm:min-h-[18.5rem] md:block md:min-h-[20rem] lg:min-h-[21.5rem]">
            <div className="relative z-10 px-6 pb-5 pt-10 sm:px-8 sm:pb-6 sm:pt-12 md:max-w-[calc(100%-15rem)] md:pb-12 md:pt-14 lg:max-w-[calc(100%-18rem)] lg:px-12 lg:pb-14 lg:pt-16 xl:max-w-[calc(100%-20rem)]">
              <h2
                id="home-host"
                className="text-2xl font-bold tracking-tight sm:text-3xl md:whitespace-nowrap md:text-[1.85rem] lg:text-[2.15rem] lg:leading-none"
              >
                List your place. Take bookings directly.
              </h2>
              <p className="text-primary-foreground mt-3 max-w-xl text-base leading-relaxed sm:text-lg">
                One place for your listing, bookings, and guest messages.
              </p>
              <ul className="text-primary-foreground mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm sm:text-[15px]">
                {HOST_FACTS.map((fact) => (
                  <li key={fact} className="flex items-center gap-1.5">
                    <Check className="text-primary size-4 shrink-0" aria-hidden />
                    {fact}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Link
                  to="/for-hosts"
                  className="public-cta text-primary-strong inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold outline-none transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                >
                  Become a host
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  to="/for-hosts/pricing"
                  className="public-cta inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-6 text-sm font-semibold text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
                >
                  See plans
                </Link>
              </div>
            </div>

            <div
              className="pointer-events-none relative mx-auto w-56 shrink-0 sm:w-64 md:absolute md:bottom-0 md:right-1 md:mx-0 md:w-64 lg:right-3 lg:w-80 xl:right-5 xl:w-[22rem]"
              aria-hidden
            >
              <div className="motion-safe:animate-float relative -mb-10 sm:-mb-11 md:-mb-12 lg:-mb-[3.25rem]">
                <KameMascotImage
                  pose="public-pages"
                  className="drop-shadow-[0_18px_30px_rgba(0,0,0,0.28)]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
