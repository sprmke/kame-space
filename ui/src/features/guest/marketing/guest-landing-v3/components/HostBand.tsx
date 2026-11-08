import { Link } from 'react-router-dom';

import { ArrowRight } from 'lucide-react';

import { PLATFORM_APP_NAME } from '@/lib/platformBranding';

/** Closing band for owners. Brand gradient is reserved for this one surface on the page. */
export function HostBand() {
  return (
    <section aria-labelledby="v3-host" className="public-section-y">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[image:var(--brand-gradient)] p-6 text-white sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:rounded-[2rem] lg:p-12">
          <div className="max-w-xl">
            <h2 id="v3-host" className="public-section-title text-balance font-semibold">
              Have a unit? Start earning from it.
            </h2>
            <p className="public-lead mt-2 text-white/85">
              List it on {PLATFORM_APP_NAME} for free and take bookings directly.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
            <Link
              to="/for-hosts"
              className="public-cta text-primary-strong inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 font-semibold outline-none transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              Become a host
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to="/for-hosts/pricing"
              className="public-cta inline-flex items-center justify-center rounded-full border border-white/40 px-6 font-semibold text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
