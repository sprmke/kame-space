import { Children, type ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

import { useHorizontalCarouselScroll } from '@/features/guest/marketing/shared/hooks/useHorizontalCarouselScroll';

import { cn } from '@/lib/utils';

/** One card slot: most of a phone screen with the next card peeking, 3 per row on tablet, 4 on desktop. */
const SLOT =
  'w-[72vw] max-w-[280px] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] sm:max-w-none lg:w-[calc((100%-3.75rem)/4)]';

interface ListingRailProps {
  id: string;
  title: string;
  hint: string;
  /** Full list page for this listing type. */
  to: string;
  /** Link label, e.g. "See all 24 stays". */
  seeAllLabel: string;
  /** Mascot pose for the closing tile, a file name in `/marketing/home/mascot/`. */
  mascot: string;
  /** Changes when the items change, so the arrows re-measure. */
  itemsKey: unknown;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * One listing type as a single swipeable row. Arrows page it on desktop, a thin bar shows
 * how far along the row is, and the row always ends in a tile that opens the full list.
 */
export function ListingRail({
  id,
  title,
  hint,
  to,
  seeAllLabel,
  mascot,
  itemsKey,
  children,
  footer,
}: ListingRailProps) {
  const { scrollRef, canScrollLeft, canScrollRight, scrollByCards } = useHorizontalCarouselScroll(
    [itemsKey],
    '[data-rail-slot]'
  );
  const { scrollXProgress } = useScroll({ container: scrollRef });
  const barScale = useTransform(scrollXProgress, [0, 1], [0.18, 1]);
  const scrollable = canScrollLeft || canScrollRight;

  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h3 id={id} className="text-foreground text-lg font-semibold tracking-tight lg:text-xl">
            {title}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-sm">{hint}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {/* When the whole row fits, the closing tile is already on screen and is the link. */}
          {scrollable ? (
            <Link
              to={to}
              className="text-foreground focus-visible:ring-ring group/all relative inline-flex h-9 items-center gap-1.5 rounded-full text-sm font-semibold outline-none before:absolute before:-inset-y-1 before:inset-x-0 focus-visible:ring-2 focus-visible:ring-offset-4"
            >
              <span className="decoration-foreground/30 group-hover/all:decoration-foreground underline decoration-1 underline-offset-4 transition-colors">
                {seeAllLabel}
              </span>
              <ArrowRight
                className="size-4 transition-transform duration-300 group-hover/all:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ) : null}
          {scrollable ? (
            <div className="hidden items-center gap-2 sm:flex">
              <RailButton
                label={`Previous ${title.toLowerCase()}`}
                disabled={!canScrollLeft}
                onClick={() => scrollByCards(-1)}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </RailButton>
              <RailButton
                label={`Next ${title.toLowerCase()}`}
                disabled={!canScrollRight}
                onClick={() => scrollByCards(1)}
              >
                <ChevronRight className="size-4" aria-hidden />
              </RailButton>
            </div>
          ) : null}
        </div>
      </div>

      {/* The row bleeds to the screen edge so cards slide under it instead of being cropped by the gutter. */}
      <div
        ref={scrollRef}
        className="relative -mx-[var(--public-shell-px)] mt-4 flex snap-x snap-mandatory scroll-px-[var(--public-shell-px)] gap-4 overflow-x-auto overscroll-x-contain px-[var(--public-shell-px)] pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-4 lg:mt-5 lg:gap-5 [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child) => (
          <div data-rail-slot className={SLOT}>
            {child}
          </div>
        ))}

        {/* Closing tile. It takes whatever width the cards leave, so a short row still fills the line. */}
        <div data-rail-slot className={cn(SLOT, 'grow')}>
          <Link
            to={to}
            className="focus-visible:ring-ring group/tile relative flex h-full min-h-[13rem] flex-col overflow-hidden rounded-xl bg-[hsl(var(--band))] p-4 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 lg:p-6"
          >
            <p className="text-foreground flex items-center gap-1.5 text-[15px] font-semibold lg:text-lg">
              {seeAllLabel}
              <ArrowRight
                className="size-4 transition-transform duration-300 group-hover/tile:translate-x-0.5"
                aria-hidden
              />
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm">Search, filter, and map</p>
            <img
              src={`/marketing/home/mascot/${mascot}.webp`}
              alt=""
              width={448}
              height={468}
              loading="lazy"
              decoding="async"
              className="absolute -bottom-2 right-2 h-[62%] w-auto origin-bottom object-contain transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/tile:scale-[1.05] motion-reduce:transform-none lg:right-6 lg:h-[66%]"
            />
          </Link>
        </div>
      </div>

      {scrollable ? (
        <div aria-hidden className="bg-border mt-4 h-0.5 overflow-hidden rounded-full lg:mt-5">
          <motion.div
            style={{ scaleX: barScale }}
            className="bg-foreground h-full origin-left rounded-full"
          />
        </div>
      ) : null}

      {footer}
    </section>
  );
}

function RailButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-border text-foreground hover:border-foreground/40 focus-visible:ring-ring relative flex size-9 items-center justify-center rounded-full border outline-none transition-[opacity,border-color,transform] duration-200 before:absolute before:-inset-1 focus-visible:ring-2 active:scale-95 disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
