import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight, BadgeCheck, BellRing, Sparkles } from 'lucide-react';

import { V4_SIGNUP_CTA } from '@/features/guest/marketing/for-hosts/v4/data/hostLandingV4';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

const EASE = [0.22, 1, 0.36, 1] as const;

export function V4Hero() {
  const reduceMotion = usePrefersReducedMotion();
  const rise = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 24 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <section className="border-border bg-background relative isolate overflow-hidden border-b">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(circle_at_15%_15%,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.35)_1px,transparent_1px)] [background-size:auto,56px_56px,56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />

      <div className="container mx-auto grid min-h-[calc(100svh-5rem)] items-center gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:px-8 lg:py-16 xl:gap-20">
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.1, delayChildren: 0.08 }}
          className="relative z-10 max-w-2xl"
        >
          <motion.div variants={rise} transition={{ duration: 0.55, ease: EASE }}>
            <span className="border-primary/25 bg-primary/8 text-primary-strong dark:text-primary inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
              <Sparkles className="size-3.5" aria-hidden />
              Built for independent hosts
            </span>
          </motion.div>
          <motion.h1
            variants={rise}
            transition={{ duration: 0.7, ease: EASE }}
            className="text-foreground mt-5 max-w-[11ch] text-balance text-[clamp(3.25rem,8vw,6.8rem)] font-bold leading-[0.9] tracking-[-0.065em]"
          >
            More direct. Less work.
          </motion.h1>
          <motion.p
            variants={rise}
            transition={{ duration: 0.65, ease: EASE }}
            className="text-muted-foreground mt-6 max-w-xl text-pretty text-lg leading-8 sm:text-xl"
          >
            Keep more control of every booking, then run the stay, guest support, and growth from
            one place.
          </motion.p>
          <motion.div
            variants={rise}
            transition={{ duration: 0.65, ease: EASE }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Link
              to={V4_SIGNUP_CTA.to}
              className="bg-primary-strong text-primary-foreground focus-visible:ring-primary group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-[0_18px_45px_-20px_hsl(var(--primary))] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_22px_55px_-22px_hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {V4_SIGNUP_CTA.label}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <a
              href="#how-it-works"
              className="border-border bg-background/80 text-foreground hover:bg-muted focus-visible:ring-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-6 text-sm font-semibold backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              See how it works
              <ArrowDown className="size-4" aria-hidden />
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: 35, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.18, ease: EASE }}
          className="relative min-h-[410px] sm:min-h-[540px] lg:min-h-[660px]"
        >
          <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-900 shadow-[0_40px_100px_-48px_rgba(15,23,42,0.85)] sm:rounded-[2rem]">
            <picture>
              <source
                type="image/avif"
                srcSet="/marketing/for-hosts/v4/host-hero-640.avif 640w, /marketing/for-hosts/v4/host-hero-960.avif 960w, /marketing/for-hosts/v4/host-hero-1280.avif 1280w, /marketing/for-hosts/v4/host-hero-1680.avif 1680w"
                sizes="(max-width: 1023px) 100vw, 58vw"
              />
              <img
                src="/marketing/for-hosts/v4/host-hero.jpg"
                alt="Host preparing a bright condo while checking guest updates on her phone"
                className="h-full w-full object-cover object-[62%_center]"
                width={1680}
                height={943}
                fetchPriority="high"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/5" />
          </div>

          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-5 left-4 right-4 rounded-2xl border border-white/15 bg-slate-950/80 p-4 text-white shadow-2xl backdrop-blur-xl sm:bottom-8 sm:left-8 sm:right-auto sm:w-[330px] sm:p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                  <BadgeCheck className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs text-white/55">Booking update</p>
                  <p className="mt-0.5 text-sm font-semibold">Ready for check-in</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                On track
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-white/65">
              <BellRing className="text-primary size-3.5" aria-hidden />
              Stay details sent to the guest
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
