import { useState } from 'react';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

import {
  V5Heading,
  V5_SECTION_Y,
} from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import { v5Channels } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const { channels, modules } = v5Channels;
const EASE = [0.16, 1, 0.3, 1] as const;
/** Column centers, in a 0 to 100 wide viewBox, for the five channels and four modules. */
const CHANNEL_X = [10, 30, 50, 70, 90];
const MODULE_X = [12.5, 37.5, 62.5, 87.5];

type Line = { d: string; on: boolean; soon: boolean };

/**
 * Curved links between a row of columns and the hub (lg and up). The picked channel's links
 * carry a flowing dash so the host sees where its data goes.
 */
function Links({ lines, reduceMotion }: { lines: Line[]; reduceMotion: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className="hidden h-16 w-full lg:block"
    >
      {lines.map((line) => (
        <path
          key={line.d}
          d={line.d}
          fill="none"
          vectorEffect="non-scaling-stroke"
          className={line.on ? 'stroke-primary' : 'stroke-border'}
          strokeWidth={line.on ? 2 : 1.25}
          strokeDasharray={line.on && line.soon ? '2 5' : undefined}
        />
      ))}
      {lines
        .filter((line) => line.on && !line.soon)
        .map((line) => (
          <motion.path
            key={`flow-${line.d}`}
            d={line.d}
            fill="none"
            vectorEffect="non-scaling-stroke"
            className="stroke-primary-strong"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray="3 14"
            initial={{ strokeDashoffset: 0 }}
            animate={reduceMotion ? undefined : { strokeDashoffset: -34 }}
            transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
          />
        ))}
    </svg>
  );
}

/** Phone and tablet stand-in for the curved links: one short line with a dot running down it. */
function Drop({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <span
      aria-hidden
      className="bg-border relative mx-auto block h-7 w-px overflow-hidden lg:hidden"
    >
      {reduceMotion ? null : (
        <motion.span
          className="bg-primary absolute left-0 top-0 h-2.5 w-px"
          initial={{ y: -10 }}
          animate={{ y: 28 }}
          transition={{ duration: 0.9, ease: 'linear', repeat: Infinity }}
        />
      )}
    </span>
  );
}

/**
 * Channels into one workspace. Hosts keep Facebook, Airbnb, and the rest; picking a channel
 * shows what it keeps in sync inside Kame (calendar, bookings, inbox, money).
 */
export function V5WhyDirect() {
  const reduceMotion = usePrefersReducedMotion();
  const [active, setActive] = useState<number>(v5Channels.defaultChannel);
  const channel = channels[active];
  const fed = new Set(channel.feeds);

  const inLines: Line[] = CHANNEL_X.map((x, index) => ({
    d: `M ${x} 0 C ${x} 24, 50 16, 50 40`,
    on: index === active,
    soon: Boolean(channel.soon),
  }));
  const outLines: Line[] = MODULE_X.map((x, index) => ({
    d: `M 50 0 C 50 24, ${x} 16, ${x} 40`,
    on: fed.has(modules[index].id),
    soon: Boolean(channel.soon),
  }));

  return (
    <section id="channels" className={cn('scroll-mt-20', V5_SECTION_Y)}>
      <div className="public-shell">
        <V5Heading title={v5Channels.title} lead={v5Channels.lead} align="center" />

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mx-auto mt-7 max-w-5xl lg:mt-9"
        >
          <div
            role="group"
            aria-label={v5Channels.channelsLabel}
            className="grid grid-cols-2 gap-2 lg:grid-cols-5"
          >
            {channels.map((item, index) => {
              const selected = index === active;
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActive(index)}
                  className={cn(
                    'focus-visible:ring-ring flex min-h-14 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    item.id === 'direct' && 'max-lg:col-span-2',
                    selected
                      ? 'border-primary-strong bg-primary-strong text-white'
                      : cn(
                          'bg-card text-foreground hover:border-primary/40',
                          item.soon ? 'border-dashed' : 'border-border'
                        )
                  )}
                >
                  <ItemIcon
                    className={cn(
                      'size-5 shrink-0 max-[359px]:hidden',
                      selected ? 'text-white' : 'text-primary'
                    )}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-tight">
                      {item.name}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate text-xs leading-tight',
                        selected ? 'text-white' : 'text-muted-foreground'
                      )}
                    >
                      {item.status}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <Links lines={inLines} reduceMotion={reduceMotion} />
          <Drop reduceMotion={reduceMotion} />

          <div className="relative mx-auto w-fit">
            {reduceMotion ? null : (
              <span
                aria-hidden
                className="bg-primary/25 absolute inset-0 animate-ping rounded-full [animation-duration:2.4s]"
              />
            )}
            <div className="bg-primary-strong relative flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5 text-white shadow-[0_14px_30px_-14px_rgba(0,0,0,0.45)]">
              {/* The sync bust is drawn for a round frame, so it fills the circle edge to edge. */}
              <span className="size-12 shrink-0 overflow-hidden rounded-full bg-white/15">
                <KameMascotImage pose="v5-sync" lazy />
              </span>
              <span>
                <span className="block text-sm font-bold leading-tight">{v5Channels.hubName}</span>
                <span className="block text-xs leading-tight text-white">{v5Channels.hubLine}</span>
              </span>
            </div>
          </div>

          <Links lines={outLines} reduceMotion={reduceMotion} />
          <Drop reduceMotion={reduceMotion} />

          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            {modules.map((item) => {
              const on = fed.has(item.id);
              const ItemIcon = item.icon;
              return (
                <li
                  key={item.id}
                  className={cn(
                    'relative rounded-2xl border p-3 transition-colors duration-300 sm:p-4',
                    on
                      ? cn('border-primary/50 bg-primary/5', channel.soon && 'border-dashed')
                      : 'border-border bg-card'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-xl transition-colors duration-300',
                      on ? 'bg-primary-strong text-white' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <ItemIcon className="size-4" strokeWidth={2} aria-hidden />
                  </span>
                  <p className="text-foreground mt-2.5 text-sm font-bold">{item.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-snug sm:text-[13px]">
                    {item.line}
                  </p>
                  {on && !channel.soon ? (
                    <Check
                      className="text-primary absolute right-3 top-3 size-4"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
