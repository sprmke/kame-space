import { useRef, type ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, BadgeCheck } from 'lucide-react';

import { Rise, Tick } from '@/features/guest/marketing/guest-home/components/ScrubParts';
import type { Progress } from '@/features/guest/marketing/guest-home/lib/scrub';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

/**
 * Why a guest books here. Every claim follows `docs/product-positioning.md` (branch `codex/core-product-advantages`) (guest
 * advantages 1, 2, 4, 7 and 10) and its guardrails: "may", "some hosts", "when turned on".
 * Each panel's picture is driven by its own scroll position, forward and back.
 */
export function WhyBookHere() {
  return (
    <section aria-labelledby="home-why" className="public-section-y">
      <div className="public-shell">
        <div className="max-w-2xl">
          <h2
            id="home-why"
            className="public-section-title text-foreground text-balance font-semibold"
          >
            Why book on {PLATFORM_APP_NAME}
          </h2>
          <p className="public-lead text-muted-foreground mt-2 text-pretty">
            You deal with the host directly, and we keep the details of your stay in one place.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:mt-10 lg:grid-cols-12 lg:gap-5">
          <Panel className="md:col-span-2 lg:col-span-7 lg:flex-row lg:items-center lg:gap-10">
            {(p) => (
              <>
                <PanelText
                  title="Book straight with the host"
                  body="Hosts here pay a flat subscription, not a cut of each stay. So you may find a better rate."
                  className="lg:flex-1"
                />
                <RateReceipt p={p} />
              </>
            )}
          </Panel>

          <Panel className="lg:col-span-5">
            {(p) => (
              <>
                <PanelText
                  title="Hosts and listings are checked first"
                  body="We review every host and every listing before it goes live."
                />
                <ReviewChecks p={p} />
              </>
            )}
          </Panel>

          <Panel className="lg:col-span-5">
            {(p) => (
              <>
                <PanelText
                  title="Ask a question, get an answer"
                  body="Some properties have an AI receptionist that can reply day or night. You can always ask for the host."
                />
                <ChatPreview p={p} />
              </>
            )}
          </Panel>

          <Panel className="lg:col-span-4">
            {(p) => (
              <>
                <PanelText
                  title="Parking, pets, and building passes"
                  body="Add them to your booking. No separate chat needed."
                />
                <Mascot p={p} pose="parking-listings" />
              </>
            )}
          </Panel>

          <Panel className="lg:col-span-3">
            {(p) => (
              <>
                <PanelText
                  title="Come back for less"
                  body="Some hosts give you a voucher for your next stay."
                />
                <Mascot p={p} pose="voucher" />
              </>
            )}
          </Panel>
        </div>

        <div className="mt-8 flex justify-center lg:mt-12">
          <Link
            to="/properties"
            className="bg-primary-strong text-primary-foreground focus-visible:ring-ring group inline-flex h-12 items-center gap-3 rounded-full pl-6 pr-1.5 text-[15px] font-semibold outline-none transition-transform duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            Find a stay
            <span className="flex size-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * A flat panel whose contents play as it travels up the screen: 0 when its top edge
 * enters near the bottom, 1 by the time it reaches the upper third.
 */
function Panel({
  className,
  children,
}: {
  className?: string;
  children: (p: Progress) => ReactNode;
}) {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.95', 'start 0.3'] });
  const eased = useSpring(scrollYProgress, { stiffness: 260, damping: 34, mass: 0.3 });
  const finished = useMotionValue(1);

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-6 overflow-hidden rounded-3xl bg-[hsl(var(--band))] p-5 sm:p-6 lg:p-8',
        className
      )}
    >
      {children(reduce ? finished : eased)}
    </div>
  );
}

function PanelText({
  title,
  body,
  className,
}: {
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="text-foreground text-balance text-lg font-semibold leading-snug tracking-tight lg:text-xl">
        {title}
      </h3>
      <p className="text-muted-foreground mt-1.5 max-w-[42ch] text-pretty text-[15px] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

/** Example price breakdown. The platform line stays at zero for stays. */
function RateReceipt({ p }: { p: Progress }) {
  return (
    <div
      aria-hidden
      className="bg-card mt-auto w-full rounded-2xl p-4 text-sm lg:mt-0 lg:w-[19rem] lg:shrink-0 lg:p-5"
    >
      <p className="text-muted-foreground text-xs">Example stay</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-foreground">₱4,500 × 2 nights</span>
        <span className="text-foreground font-semibold tabular-nums">₱9,000</span>
      </div>
      <Rise
        p={p}
        at={0.25}
        span={0.2}
        y={10}
        className="mt-2 flex items-baseline justify-between gap-3"
      >
        <span className="text-foreground">{PLATFORM_APP_NAME} cut of this stay</span>
        <span className="text-brand-ink font-semibold tabular-nums">₱0</span>
      </Rise>
      <Rise
        p={p}
        at={0.5}
        span={0.2}
        y={10}
        className="border-border mt-3 flex items-baseline justify-between gap-3 border-t pt-3"
      >
        <span className="text-foreground font-semibold">You pay your host</span>
        <span className="text-foreground text-base font-semibold tabular-nums">₱9,000</span>
      </Rise>
      <p className="text-muted-foreground mt-3 text-xs">Your host sets the rate and any fees.</p>
    </div>
  );
}

const CHECKS = ['Government ID', 'Right to host the unit', 'Listing reviewed'];

function ReviewChecks({ p }: { p: Progress }) {
  return (
    <div aria-hidden className="mt-auto space-y-2">
      {CHECKS.map((label, i) => (
        <div key={label} className="bg-card flex items-center gap-3 rounded-2xl px-4 py-3">
          <span className="text-foreground flex-1 text-[15px]">{label}</span>
          <Tick p={p} at={0.2 + i * 0.18} span={0.12} />
        </div>
      ))}
      <Rise p={p} at={0.74} span={0.16} y={8} className="flex items-center gap-2 pt-1">
        <BadgeCheck className="text-brand-ink size-[18px] shrink-0" strokeWidth={1.8} />
        <span className="text-muted-foreground text-sm">
          <span className="text-foreground font-semibold">Recommended</span> means extra checks.
        </span>
      </Rise>
    </div>
  );
}

function ChatPreview({ p }: { p: Progress }) {
  return (
    <div aria-hidden className="mt-auto space-y-2.5 text-[15px] leading-snug">
      <p className="bg-primary-strong text-primary-foreground ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5">
        Is there parking in the building?
      </p>
      <Rise p={p} at={0.22} span={0.2} y={12} className="flex items-end gap-2">
        <img
          src="/marketing/home/mascot/listening.webp"
          alt=""
          width={448}
          height={468}
          loading="lazy"
          decoding="async"
          className="bg-card size-9 shrink-0 rounded-full object-cover object-top"
        />
        <p className="bg-card text-foreground w-fit max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5">
          Yes. There are paid slots in the same building.
        </p>
      </Rise>
      <Rise
        p={p}
        at={0.5}
        span={0.2}
        y={12}
        className="bg-primary-strong text-primary-foreground ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5"
      >
        Can I talk to the host?
      </Rise>
      <Rise p={p} at={0.74} span={0.2} y={8} className="text-muted-foreground pl-11 text-sm">
        Your host has been told and will reply here.
      </Rise>
    </div>
  );
}

/** Mascot that settles into the bottom of its panel as the panel scrolls up. */
function Mascot({ p, pose }: { p: Progress; pose: string }) {
  const y = useTransform(p, [0, 0.8], [36, 0]);
  const rotate = useTransform(p, [0, 0.8], [-5, 0]);
  return (
    <div aria-hidden className="-mb-5 mt-auto flex justify-center sm:-mb-6 lg:-mb-8">
      <motion.img
        src={`/marketing/home/mascot/${pose}.webp`}
        alt=""
        width={448}
        height={468}
        loading="lazy"
        decoding="async"
        style={{ y, rotate }}
        className="h-44 w-auto origin-bottom object-contain lg:h-48"
      />
    </div>
  );
}
