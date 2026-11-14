import { Link } from 'react-router-dom';

import { ArrowRight, Check } from 'lucide-react';

import { V4Reveal } from '@/features/guest/marketing/for-hosts/v4/components/V4Reveal';
import {
  V4_PRICING_CTA,
  V4_SIGNUP_CTA,
} from '@/features/guest/marketing/for-hosts/v4/data/hostLandingV4';

export function V4ClosingCta() {
  return (
    <section className="bg-background px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8 lg:pb-36">
      <V4Reveal className="bg-primary-strong text-primary-foreground container relative mx-auto overflow-hidden rounded-[1.75rem] px-6 py-14 shadow-[0_35px_90px_-45px_hsl(var(--primary))] sm:px-10 sm:py-20 lg:px-16 lg:py-24">
        <div className="pointer-events-none absolute -right-20 -top-36 size-[34rem] rounded-full border-[80px] border-white/5" />
        <div className="bg-primary/15 pointer-events-none absolute -bottom-52 left-1/3 size-[28rem] rounded-full blur-3xl" />
        <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="max-w-[12ch] text-balance text-4xl font-bold tracking-[-0.045em] sm:text-5xl lg:text-6xl lg:leading-[1]">
              Build the hosting business guests come back to.
            </p>
            <div className="text-primary-foreground/85 mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              {['Free to start', 'No card needed', 'Works on your phone'].map((fact) => (
                <span key={fact} className="flex items-center gap-2">
                  <Check className="text-primary size-4" aria-hidden />
                  {fact}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Link
              to={V4_SIGNUP_CTA.to}
              className="focus-visible:ring-primary group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-slate-950 transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              {V4_SIGNUP_CTA.label}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              to={V4_PRICING_CTA.to}
              className="bg-white/8 text-primary-foreground hover:bg-white/12 focus-visible:ring-primary inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 text-sm font-semibold backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              {V4_PRICING_CTA.label}
            </Link>
          </div>
        </div>
      </V4Reveal>
    </section>
  );
}
