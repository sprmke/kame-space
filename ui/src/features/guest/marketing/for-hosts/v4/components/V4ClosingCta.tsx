import { Link } from 'react-router-dom';

import { ArrowRight, Check } from 'lucide-react';

import { V4Reveal } from '@/features/guest/marketing/for-hosts/v4/components/V4Reveal';
import {
  V4_PRICING_CTA,
  V4_SIGNUP_CTA,
} from '@/features/guest/marketing/for-hosts/v4/data/hostLandingV4';

import { KameMascotImage } from '@/components/branding/KameMascotImage';

const CLOSING_FACTS = ['Free to start', 'No cut per booking', 'One stay workflow'] as const;

export function V4ClosingCta() {
  return (
    <section className="bg-background px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8 lg:pb-36">
      <V4Reveal className="bg-primary-strong text-primary-foreground container relative mx-auto overflow-hidden rounded-[1.75rem] shadow-[0_35px_90px_-45px_hsl(var(--primary))]">
        <div className="pointer-events-none absolute -right-20 -top-36 size-[34rem] rounded-full border-[80px] border-white/5" />
        <div className="bg-primary/15 pointer-events-none absolute -bottom-52 left-1/3 size-[28rem] rounded-full blur-3xl" />

        <div className="relative flex min-h-[20rem] flex-col sm:min-h-[22rem] md:block md:min-h-[24rem] lg:min-h-[26rem]">
          <div className="relative z-10 px-6 py-14 sm:px-10 sm:py-16 md:max-w-[calc(100%-17rem)] lg:max-w-[calc(100%-20rem)] lg:px-16 lg:py-20 xl:max-w-[calc(100%-22rem)]">
            <p className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl md:whitespace-nowrap lg:text-[2.75rem] lg:leading-none">
              List your place. Take bookings directly.
            </p>
            <p className="text-primary-foreground/90 mt-4 max-w-xl text-base leading-relaxed sm:text-lg">
              One place for your listing, bookings, and guest messages.
            </p>
            <div className="text-primary-foreground mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm sm:text-[15px]">
              {CLOSING_FACTS.map((fact) => (
                <span key={fact} className="flex items-center gap-2">
                  <Check className="text-primary size-4" aria-hidden />
                  {fact}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

          <div
            className="pointer-events-none relative mx-auto w-64 shrink-0 sm:w-72 md:absolute md:bottom-0 md:right-3 md:mx-0 md:w-80 lg:right-5 lg:w-96 xl:right-7 xl:w-[26rem]"
            aria-hidden
          >
            <div className="motion-safe:animate-float relative -mb-11 sm:-mb-12 md:-mb-[3.25rem] lg:-mb-14">
              <KameMascotImage
                pose="public-pages"
                className="drop-shadow-[0_22px_40px_rgba(0,0,0,0.3)]"
              />
            </div>
          </div>
        </div>
      </V4Reveal>
    </section>
  );
}
