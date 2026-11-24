import { useRef, type ComponentType } from 'react';

import { useScroll } from 'framer-motion';

import {
  BookScreen,
  FannedPhone,
  GuideScreen,
  PhoneFrame,
  TripScreen,
} from '@/features/guest/marketing/for-hosts/shared/HostGuestScreens';
import {
  V5Heading,
  V5_SECTION_Y,
} from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import { v5Guests } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import { useIsBelowLg, usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const SCREENS: Record<string, ComponentType> = {
  book: BookScreen,
  guide: GuideScreen,
  trip: TripScreen,
};

/**
 * The guest side: booking page, stay guide, and trip page as three phones on one soft band.
 * From `lg` the outer phones fan out as the band scrolls in; below that it is a swipeable row.
 */
export function V5Guests() {
  const prefersReduced = usePrefersReducedMotion();
  const isBelowLg = useIsBelowLg();
  // The fan only reads on the three-up desktop row; the phone carousel stays still.
  const reduceMotion = prefersReduced || isBelowLg;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center 0.6'] });

  return (
    <section id="guests" className={cn('public-shell scroll-mt-20', V5_SECTION_Y)}>
      <div className="bg-card ring-border/70 relative overflow-hidden rounded-3xl px-5 py-10 ring-1 sm:px-8 sm:py-14 lg:rounded-[2rem] lg:py-20">
        <div
          aria-hidden
          className="bg-primary/10 pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[min(56rem,90%)] -translate-x-1/2 rounded-full blur-3xl"
        />
        <div className="relative">
          <V5Heading title={v5Guests.title} lead={v5Guests.lead} align="center" />

          <div
            ref={ref}
            // A sideways-scrolling row has to be reachable by keyboard; on desktop it is a grid.
            tabIndex={isBelowLg ? 0 : undefined}
            className="focus-visible:ring-ring -mx-5 mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 sm:-mx-8 sm:px-8 lg:mx-auto lg:mt-14 lg:grid lg:max-w-4xl lg:grid-cols-3 lg:gap-8 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
          >
            {v5Guests.screens.map((screen, index) => {
              const Screen = SCREENS[screen.key];
              return (
                <div
                  key={screen.key}
                  className="w-[72%] max-w-[16rem] shrink-0 snap-center sm:w-[38%] lg:mx-auto lg:w-full lg:max-w-[16.5rem]"
                >
                  <div aria-hidden>
                    <FannedPhone
                      index={index}
                      progress={scrollYProgress}
                      reduceMotion={reduceMotion}
                    >
                      <PhoneFrame>
                        <Screen />
                      </PhoneFrame>
                    </FannedPhone>
                  </div>
                  <div className="mt-6 text-center lg:mt-12">
                    <h3 className="text-foreground text-base font-bold sm:text-lg">
                      {screen.title}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">{screen.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
