import { useState } from 'react';

import { Link } from 'react-router-dom';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';

import { V4Reveal } from '@/features/guest/marketing/for-hosts/v4/components/V4Reveal';
import { v4FaqItems } from '@/features/guest/marketing/for-hosts/v4/data/hostLandingV4';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export function V4Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduceMotion = usePrefersReducedMotion();

  return (
    <section id="faq" className="bg-background scroll-mt-24 py-20 sm:py-28 lg:py-36">
      <div className="container mx-auto grid gap-12 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 lg:px-8">
        <V4Reveal className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-foreground max-w-[10ch] text-balance text-4xl font-bold tracking-[-0.045em] sm:text-5xl">
            Clear answers before you start.
          </h2>
          <p className="text-muted-foreground mt-5 max-w-sm text-base leading-7">
            Need something more specific? We can help you map Kame to your current hosting setup.
          </p>
          <Link
            to="/contact"
            className="text-primary-strong focus-visible:ring-primary dark:text-primary group mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
          >
            Talk to us
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </V4Reveal>

        <V4Reveal delay={0.08} className="border-border border-t">
          {v4FaqItems.map((item, index) => {
            const open = index === openIndex;
            const panelId = `v4-faq-${index}`;
            return (
              <article key={item.question} className="border-border border-b">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : index)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="text-foreground focus-visible:ring-primary flex min-h-[72px] w-full items-center justify-between gap-6 py-5 text-left text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:min-h-[84px] sm:text-lg"
                  >
                    {item.question}
                    <Plus
                      className={cn(
                        'text-primary size-5 shrink-0 transition-transform',
                        open && 'rotate-45'
                      )}
                      aria-hidden
                    />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      id={panelId}
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="text-muted-foreground max-w-3xl pb-6 text-base leading-7">
                        {item.answer}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </article>
            );
          })}
        </V4Reveal>
      </div>
    </section>
  );
}
