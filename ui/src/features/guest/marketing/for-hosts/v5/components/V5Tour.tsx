import { useRef } from 'react';

import { motion, useScroll, useTransform } from 'framer-motion';

import { HostDashboardTourPlayer } from '@/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer';
import {
  V5Heading,
  V5_SECTION_Y,
} from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import { v5Tour } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/** The narrated product tour. The player grows to full size as it scrolls into view. */
export function V5Tour() {
  const reduceMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.25'] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [40, 24]);

  return (
    <section id="tour" className={cn('bg-muted/40 scroll-mt-20', V5_SECTION_Y)}>
      <div className="public-shell">
        <V5Heading title={v5Tour.title} lead={v5Tour.lead} align="center" />

        <motion.div
          ref={ref}
          style={reduceMotion ? undefined : { scale, borderRadius: radius }}
          className="mx-auto mt-7 max-w-6xl origin-top overflow-hidden lg:mt-10"
        >
          <HostDashboardTourPlayer variant="marketing" />
        </motion.div>
      </div>
    </section>
  );
}
