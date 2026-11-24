import { useState } from 'react';

import { Link } from 'react-router-dom';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';

import { Reveal } from '@/features/guest/marketing/for-hosts/shared/Reveal';
import {
  V5_SECTION_Y,
  V5_TITLE_CLASS,
} from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import { v5Faq } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/** Title and contact link hold on the left from `lg`; the questions open one at a time. */
export function V5Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduceMotion = usePrefersReducedMotion();

  return (
    <section id="faq" className={cn('scroll-mt-20', V5_SECTION_Y)}>
      <div className="public-shell grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <h2 className={cn(V5_TITLE_CLASS, 'lg:max-w-[12ch]')}>{v5Faq.title}</h2>
          <Link
            to={v5Faq.contact.to}
            className="text-brand-ink focus-visible:ring-ring group mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 lg:mt-4"
          >
            {v5Faq.contact.label}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </Reveal>

        <Reveal delay={0.08} className="border-border border-t">
          {v5Faq.items.map((item, index) => {
            const open = index === openIndex;
            const panelId = `v5-faq-${index}`;
            return (
              <div key={item.question} className="border-border border-b">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : index)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="text-foreground focus-visible:ring-ring flex min-h-16 w-full items-center justify-between gap-6 py-4 text-left text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:min-h-20 sm:text-lg"
                  >
                    {item.question}
                    <Plus
                      className={cn(
                        'text-primary size-5 shrink-0 transition-transform duration-300',
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
                      <p className="text-muted-foreground max-w-2xl pb-5 text-[15px] leading-relaxed sm:pb-6 sm:text-base">
                        {item.answer}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
