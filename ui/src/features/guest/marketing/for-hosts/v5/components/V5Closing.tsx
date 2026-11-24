import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

import { Reveal } from '@/features/guest/marketing/for-hosts/shared/Reveal';
import { V5_SECTION_Y } from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import {
  V5_PRICING_CTA,
  V5_SIGNUP_CTA,
  v5Closing,
} from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

/** Closing band: the ask, three facts, two actions. Kame rises from the edge as it scrolls in. */
export function V5Closing() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <section className={cn('public-shell', V5_SECTION_Y)}>
      <Reveal className="bg-primary-strong relative overflow-hidden rounded-3xl text-white lg:rounded-[2rem]">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-36 size-[34rem] rounded-full border-[80px] border-white/5"
        />

        <div className="relative flex flex-col md:block md:min-h-[22rem] lg:min-h-[25rem]">
          <div className="relative z-10 px-6 pb-2 pt-10 sm:px-10 sm:pt-12 md:max-w-[calc(100%-17rem)] md:pb-12 lg:max-w-[calc(100%-22rem)] lg:px-16 lg:py-16">
            <h2 className="text-balance text-[1.75rem] font-bold leading-[1.1] tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem]">
              {v5Closing.title}
            </h2>
            <ul className="mt-5 flex flex-col gap-2 text-sm text-white sm:text-[15px] lg:mt-6">
              {v5Closing.facts.map((fact) => (
                <li key={fact} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                  {fact}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row lg:mt-8">
              <Link
                to={V5_SIGNUP_CTA.to}
                onClick={() => captureAppEvent('for_hosts_cta_clicked', { cta: 'create_account' })}
                className="public-cta text-primary-strong focus-visible:ring-offset-primary-strong group inline-flex items-center justify-center gap-2 rounded-full bg-white font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
              >
                {V5_SIGNUP_CTA.label}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                to={V5_PRICING_CTA.to}
                onClick={() => captureAppEvent('for_hosts_cta_clicked', { cta: 'view_pricing' })}
                className="public-cta focus-visible:ring-offset-primary-strong inline-flex items-center justify-center rounded-full border border-white/40 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
              >
                {V5_PRICING_CTA.label}
              </Link>
            </div>
          </div>

          <motion.div
            aria-hidden
            initial={reduceMotion ? false : { y: 90, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ type: 'spring', stiffness: 110, damping: 15, delay: 0.25 }}
            className="pointer-events-none relative mx-auto w-56 shrink-0 sm:w-64 md:absolute md:bottom-0 md:right-4 md:mx-0 md:w-72 lg:right-10 lg:w-[22rem]"
          >
            <div className="motion-safe:animate-float relative -mb-9 sm:-mb-10 md:-mb-11 lg:-mb-12">
              <KameMascotImage
                pose="properties"
                className="drop-shadow-[0_22px_40px_rgba(0,0,0,0.3)]"
              />
            </div>
          </motion.div>
        </div>
      </Reveal>
    </section>
  );
}
