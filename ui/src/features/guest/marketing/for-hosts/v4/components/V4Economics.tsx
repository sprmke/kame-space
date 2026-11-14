import { Link } from 'react-router-dom';

import { ArrowRight, Check, X } from 'lucide-react';

import { V4Reveal } from '@/features/guest/marketing/for-hosts/v4/components/V4Reveal';
import { V4_PRICING_CTA } from '@/features/guest/marketing/for-hosts/v4/data/hostLandingV4';

const marketplaceRows = [
  'Pay a percentage per booking',
  'Guest relationship stays on the channel',
  'Operations live elsewhere',
];
const kameRows = [
  'Subscription for property tools',
  'Your direct booking relationship',
  'Stay operations in the same workspace',
];

export function V4Economics() {
  return (
    <section
      id="features"
      className="bg-background scroll-mt-24 overflow-hidden py-20 sm:py-28 lg:py-36"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.8fr] lg:gap-16">
          <V4Reveal>
            <p className="text-primary-strong dark:text-primary text-sm font-semibold">
              A better direct-booking model
            </p>
            <h2 className="text-foreground mt-4 max-w-[12ch] text-balance text-4xl font-bold tracking-[-0.045em] sm:text-5xl lg:text-6xl lg:leading-[0.98]">
              Stop giving every booking the same expensive shape.
            </h2>
          </V4Reveal>
          <V4Reveal delay={0.08}>
            <p className="text-muted-foreground max-w-xl text-pretty text-lg leading-8">
              Marketplaces are useful for discovery. Your repeat guests and direct demand deserve a
              channel you control.
            </p>
            <Link
              to={V4_PRICING_CTA.to}
              className="text-primary-strong focus-visible:ring-primary dark:text-primary group mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
            >
              {V4_PRICING_CTA.label}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          </V4Reveal>
        </div>

        <div className="mt-14 grid gap-4 lg:mt-20 lg:grid-cols-[0.86fr_1.14fr]">
          <V4Reveal className="border-border bg-muted/40 rounded-[1.5rem] border p-6 sm:p-8">
            <p className="text-muted-foreground text-sm font-semibold">Marketplace-only setup</p>
            <p className="text-foreground mt-5 text-2xl font-bold tracking-tight">
              Useful reach, limited ownership.
            </p>
            <ul className="mt-8 space-y-5">
              {marketplaceRows.map((row) => (
                <li key={row} className="text-muted-foreground flex gap-3 text-sm leading-6">
                  <span className="bg-muted text-muted-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                    <X className="size-3" aria-hidden />
                  </span>
                  {row}
                </li>
              ))}
            </ul>
          </V4Reveal>

          <V4Reveal
            delay={0.08}
            className="border-primary/25 bg-primary-strong text-primary-foreground relative overflow-hidden rounded-[1.5rem] border p-6 shadow-[0_30px_80px_-45px_hsl(var(--primary))] sm:p-8 lg:p-10"
          >
            <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border-[48px] border-white/5" />
            <p className="text-primary-foreground/85 relative text-sm font-semibold">
              Kame direct channel
            </p>
            <p className="relative mt-5 max-w-md text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              More control before, during, and after the stay.
            </p>
            <ul className="relative mt-8 grid gap-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {kameRows.map((row) => (
                <li key={row} className="text-primary-foreground/80 flex gap-3 text-sm leading-6">
                  <span className="bg-primary-strong text-primary-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                    <Check className="size-3" aria-hidden />
                  </span>
                  {row}
                </li>
              ))}
            </ul>
          </V4Reveal>
        </div>
      </div>
    </section>
  );
}
