import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { AnimatePresence, MotionConfig, motion, useInView } from 'framer-motion';
import { Pause, Play } from 'lucide-react';

import { GuestShowcaseScene } from '@/features/guest/auth/components/GuestShowcaseScenes';
import { GUEST_SHOWCASE_CHAPTERS } from '@/features/guest/auth/lib/guestShowcaseChapters';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export interface GuestFeatureShowcaseProps {
  className?: string;
  /** Overrides the stage sizing (the side panel fits it to the viewport height). */
  stageClassName?: string;
}

/**
 * Interactive guest feature tour: live mock UI per chapter, a tab rail with an autoplay progress
 * fill, pause on hover/focus/off-screen, and no autoplay under reduced motion.
 */
export function GuestFeatureShowcase({ className, stageClassName }: GuestFeatureShowcaseProps) {
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inView = useInView(rootRef, { amount: 0.4 });
  const reducedMotion = usePrefersReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);

  useEffect(() => {
    const sync = () => setPageHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const autoplay = !reducedMotion && !userPaused;
  const running = autoplay && inView && !hovered && !focused && !pageHidden;
  const active = GUEST_SHOWCASE_CHAPTERS[activeIndex];
  const count = GUEST_SHOWCASE_CHAPTERS.length;

  const goTo = useCallback(
    (index: number, focusTab = false) => {
      const next = (index + count) % count;
      setActiveIndex(next);
      if (focusTab) tabRefs.current[next]?.focus();
    },
    [count]
  );

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keyMap: Record<string, number> = {
      ArrowRight: activeIndex + 1,
      ArrowLeft: activeIndex - 1,
      Home: 0,
      End: count - 1,
    };
    const target = keyMap[event.key];
    if (target === undefined) return;
    event.preventDefault();
    goTo(target, true);
  };

  const panelId = `${baseId}-panel`;

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="What you can do as a guest"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        className={cn(
          'border-border/80 bg-card/95 flex w-full flex-col rounded-xl border p-2 shadow-md backdrop-blur-sm',
          className
        )}
      >
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${active.id}`}
          className={cn(
            'bg-background border-border/60 @container relative aspect-[4/3] overflow-hidden rounded-lg border sm:aspect-[16/10]',
            stageClassName
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={active.id}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.01 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              aria-hidden
            >
              <GuestShowcaseScene id={active.id} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-start gap-2 px-1.5 pb-1 pt-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-foreground text-base font-bold tracking-tight xl:text-lg">
              {active.title}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed sm:text-[13px]">
              {active.description}
            </p>
          </div>
          {!reducedMotion ? (
            <button
              type="button"
              onClick={() => setUserPaused((value) => !value)}
              aria-label={userPaused ? 'Play tour' : 'Pause tour'}
              className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring relative flex size-8 shrink-0 items-center justify-center rounded-full transition-colors before:absolute before:-inset-1.5 focus-visible:outline-none focus-visible:ring-2"
            >
              {userPaused ? (
                <Play className="size-4" aria-hidden />
              ) : (
                <Pause className="size-4" aria-hidden />
              )}
            </button>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="Guest features"
          className="mt-1 grid grid-cols-7 gap-0.5 sm:gap-1"
        >
          {GUEST_SHOWCASE_CHAPTERS.map((chapter, index) => {
            const selected = index === activeIndex;
            const Icon = chapter.icon;
            return (
              <button
                key={chapter.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`${baseId}-tab-${chapter.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => goTo(index)}
                onKeyDown={handleTabKeyDown}
                className={cn(
                  'focus-visible:ring-ring relative flex min-h-[52px] flex-col items-center justify-center gap-1 overflow-hidden rounded-lg px-0.5 pb-2 pt-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2',
                  selected
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="text-[9.5px] font-semibold leading-none tracking-tight sm:text-[11px] sm:tracking-normal">
                  {chapter.label}
                </span>
                {selected ? (
                  <span
                    aria-hidden
                    className="bg-primary/15 absolute inset-x-2 bottom-1 h-0.5 overflow-hidden rounded-full"
                  >
                    {autoplay ? (
                      <span
                        key={`${chapter.id}-${activeIndex}`}
                        className="bg-primary block h-full w-full origin-left rounded-full"
                        style={{
                          animation: `guest-showcase-progress ${chapter.durationMs}ms linear forwards`,
                          animationPlayState: running ? 'running' : 'paused',
                        }}
                        onAnimationEnd={() => goTo(activeIndex + 1)}
                      />
                    ) : (
                      <span className="bg-primary block h-full w-full rounded-full" />
                    )}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </MotionConfig>
  );
}
