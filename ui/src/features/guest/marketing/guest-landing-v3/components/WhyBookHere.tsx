import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import {
  ArrowRight,
  Car,
  Check,
  FileText,
  KeyRound,
  LayoutList,
  type LucideIcon,
  Wallet,
} from 'lucide-react';

import { STEP_EASE } from '@/features/guest/marketing/guest-landing-v3/components/BookingStepScenes';
import { MarketingBrandLogo } from '@/features/guest/marketing/shared/components/MarketingBrandLogo';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

type Side = 'left' | 'right';

interface Item {
  icon: LucideIcon;
  topic: string;
  /** What a guest usually ends up asking a host over chat on other sites. */
  ask: string;
  sentAt: string;
  /** What the booking already covers here. Only shipped behavior. */
  answer: string;
  side: Side;
  /** Connector length between the message and the card (desktop). */
  reach: string;
  tilt: number;
}

const ITEMS: readonly Item[] = [
  {
    icon: Car,
    topic: 'Parking',
    ask: 'Hi! Is there parking in the building?',
    sentAt: 'Mon 9:14 PM',
    answer: 'Reserve a slot in the same building',
    side: 'left',
    reach: 'w-14 xl:w-24',
    tilt: -1.5,
  },
  {
    icon: FileText,
    topic: 'Building pass',
    ask: 'Do you need copies of our IDs for the building admin?',
    sentAt: 'Tue 8:02 AM',
    answer: 'Your host prepares it from your booking form',
    side: 'right',
    reach: 'w-10 xl:w-16',
    tilt: 1.25,
  },
  {
    icon: LayoutList,
    topic: 'Booking status',
    ask: 'Just checking, is our booking confirmed?',
    sentAt: 'Wed 6:47 PM',
    answer: 'Every step on one trip page',
    side: 'left',
    reach: 'w-8 xl:w-12',
    tilt: 1,
  },
  {
    icon: KeyRound,
    topic: 'Check-in details',
    ask: 'What’s the unit number and the Wi-Fi?',
    sentAt: 'Fri 1:10 PM',
    answer: 'Waiting in your stay guide',
    side: 'right',
    reach: 'w-16 xl:w-28',
    tilt: -1,
  },
  {
    icon: Wallet,
    topic: 'Security deposit',
    ask: 'Any update on our security deposit?',
    sentAt: 'Tue 10:31 AM',
    answer: 'Track the refund until it lands',
    side: 'left',
    reach: 'w-12 xl:w-20',
    tilt: -0.75,
  },
];

const N = ITEMS.length;

/** Three-column stage on desktop: messages | booking card | messages. One column on phone. */
const COLS =
  'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_29rem_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_30rem_minmax(0,1fr)]';

/** A row is handled once its middle passes this line (fraction of viewport height). */
const SCAN_LINE = 0.62;

/**
 * Before/after: the chat messages other sites leave you to send, absorbed one by one into a
 * single booking as the visitor scrolls. Reversible; final state under reduced motion.
 */
export function WhyBookHere() {
  const reduce = usePrefersReducedMotion();
  const listRef = useRef<HTMLOListElement>(null);
  const [count, setCount] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: [`start ${SCAN_LINE}`, `end ${SCAN_LINE}`],
  });
  const toCount = (v: number) => Math.max(0, Math.min(N, Math.floor(v * N + 0.5)));
  useMotionValueEvent(scrollYProgress, 'change', (v) => setCount(toCount(v)));
  useEffect(() => {
    setCount(toCount(scrollYProgress.get()));
  }, [scrollYProgress]);

  const handled = reduce ? N : count;

  return (
    <section aria-labelledby="v3-why" className="public-section-y overflow-x-clip">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="border-border text-muted-foreground inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold">
            Why {PLATFORM_APP_NAME}
          </span>
          <h2
            id="v3-why"
            className="public-section-title text-foreground mt-3 text-balance font-semibold"
          >
            The messages you won’t have to send
          </h2>
          <p className="public-lead text-muted-foreground mx-auto mt-3 max-w-xl text-pretty">
            On other booking sites, condo details like parking and building passes usually mean a
            chat with your host. On {PLATFORM_APP_NAME} they come with the booking.
          </p>
        </div>

        <div className="relative mx-auto mt-10 max-w-md lg:mt-14 lg:max-w-none">
          {/* Card surface sits behind the middle column so rows and messages share one grid. */}
          <div
            aria-hidden
            className={cn(
              'bg-card absolute inset-y-0 left-0 right-0 rounded-[1.75rem] ring-1 transition-shadow duration-700 lg:left-1/2 lg:right-auto lg:w-[29rem] lg:-translate-x-1/2 xl:w-[30rem]',
              'shadow-[0_40px_80px_-40px_rgba(15,23,42,0.28)] dark:shadow-[0_40px_80px_-40px_rgba(0,0,0,0.7)]',
              handled === N ? 'ring-primary/30' : 'ring-border/80'
            )}
          />

          <div className={cn(COLS, 'relative')}>
            <div className="hidden lg:block" />
            <div className="border-border/70 flex items-center justify-between gap-3 border-b px-5 py-4 lg:px-6 lg:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <MarketingBrandLogo
                  showWordmark={false}
                  markClassName="size-9 rounded-xl shadow-sm md:size-9 md:rounded-xl md:shadow-sm"
                />
                <div className="min-w-0">
                  <p className="text-foreground truncate text-[15px] font-semibold">
                    Booked on {PLATFORM_APP_NAME}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">Condo stay · Fri to Sun</p>
                </div>
              </div>
              <RemainingPill left={N - handled} reduce={reduce} />
            </div>
            <div className="hidden lg:block" />
          </div>

          <ol
            ref={listRef}
            aria-label={`What other booking sites leave to chat, and how ${PLATFORM_APP_NAME} covers it`}
            className="relative pb-2"
          >
            {ITEMS.map((item, i) => (
              <Row
                key={item.topic}
                item={item}
                index={i}
                done={i < handled}
                active={active === i}
                reduce={reduce}
                onActive={setActive}
              />
            ))}
          </ol>
        </div>

        <div className="mt-10 flex justify-center lg:mt-14">
          <FindStayCta />
        </div>
      </div>
    </section>
  );
}

function Row({
  item,
  index,
  done,
  active,
  reduce,
  onActive,
}: {
  item: Item;
  index: number;
  done: boolean;
  active: boolean;
  reduce: boolean;
  onActive: (i: number | null) => void;
}) {
  const Icon = item.icon;
  const left = item.side === 'left';

  const side = (
    <div
      className={cn('hidden min-w-0 items-center lg:flex', left ? 'justify-end' : 'justify-start')}
    >
      {left ? (
        <>
          <Message item={item} done={done} active={active} reduce={reduce} />
          <Wire item={item} done={done} active={active} reduce={reduce} />
        </>
      ) : (
        <>
          <Wire item={item} done={done} active={active} reduce={reduce} />
          <Message item={item} done={done} active={active} reduce={reduce} />
        </>
      )}
    </div>
  );

  return (
    <li
      className={COLS}
      onPointerEnter={() => onActive(index)}
      onPointerLeave={() => onActive(null)}
    >
      {left ? side : <div className="hidden lg:block" />}

      <div
        className={cn(
          'relative flex min-h-[5.5rem] items-center gap-4 overflow-hidden px-5 lg:overflow-visible lg:px-6',
          index > 0 &&
            'before:bg-border/70 before:absolute before:inset-x-5 before:top-0 before:h-px'
        )}
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl transition-[background-color,color,transform] duration-500',
            done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            active && done && 'scale-105'
          )}
        >
          <Icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
        </span>

        <div className="min-w-0 flex-1 py-4">
          <p className="text-foreground text-[15px] font-semibold">{item.topic}</p>
          <div className="relative mt-0.5">
            <motion.p
              initial={false}
              animate={{
                opacity: done ? 1 : 0,
                y: done ? 0 : 4,
                filter: done ? 'blur(0px)' : 'blur(3px)',
              }}
              transition={{
                duration: reduce ? 0 : 0.45,
                ease: STEP_EASE,
                delay: done && !reduce ? 0.2 : 0,
              }}
              className="text-muted-foreground text-sm leading-snug"
            >
              {item.answer}
            </motion.p>
            <motion.span
              aria-hidden
              initial={false}
              animate={{ opacity: done ? 0 : 1 }}
              transition={{ duration: reduce ? 0 : 0.25 }}
              className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2"
            >
              <span className="bg-muted h-2 w-3/5 rounded-full" />
            </motion.span>
          </div>
        </div>

        <span className="relative flex size-6 shrink-0 items-center justify-center" aria-hidden>
          <span className="border-border absolute inset-0 rounded-full border border-dashed" />
          <motion.span
            initial={false}
            animate={{ scale: done ? 1 : 0, opacity: done ? 1 : 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: 'spring', stiffness: 460, damping: 22, delay: done ? 0.3 : 0 }
            }
            className="bg-primary-strong text-primary-foreground absolute inset-0 flex items-center justify-center rounded-full"
          >
            <Check className="size-3.5" strokeWidth={3} />
          </motion.span>
        </span>

        {/* Phone: the message covers its row, then slides off like a dismissed notification. */}
        <motion.div
          initial={false}
          animate={done ? { x: '115%', opacity: 0 } : { x: '0%', opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.55, ease: STEP_EASE }}
          className="bg-muted absolute inset-y-2.5 left-[4.25rem] right-3 flex flex-col justify-center rounded-2xl rounded-br-md px-3.5 py-2 lg:hidden"
        >
          <p className="text-foreground line-clamp-2 text-[13px] leading-snug">
            <span className="sr-only">On other sites you would ask: </span>
            {item.ask}
          </p>
          <p className="text-muted-foreground mt-1 text-[11px] font-medium">{item.sentAt}</p>
        </motion.div>
      </div>

      {left ? <div className="hidden lg:block" /> : side}
    </li>
  );
}

/** Desktop chat bubble. Crossed off once the booking covers it. */
function Message({
  item,
  done,
  active,
  reduce,
}: {
  item: Item;
  done: boolean;
  active: boolean;
  reduce: boolean;
}) {
  const left = item.side === 'left';
  const strike: CSSProperties = {
    backgroundImage: 'linear-gradient(currentColor, currentColor)',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: '0 58%',
    backgroundSize: done ? '100% 1.5px' : '0% 1.5px',
    transition: reduce ? 'none' : 'background-size 500ms cubic-bezier(0.32,0.72,0,1) 150ms',
  };

  return (
    <motion.div
      initial={false}
      animate={{ rotate: done ? 0 : item.tilt, x: done ? (left ? -6 : 6) : 0 }}
      transition={{ duration: reduce ? 0 : 0.6, ease: STEP_EASE }}
      className={cn(
        'relative min-w-0 max-w-[15rem] rounded-[1.25rem] px-4 py-3 ring-1 transition-[background-color,box-shadow] duration-500 xl:max-w-[17rem]',
        left ? 'rounded-br-md' : 'rounded-bl-md',
        done
          ? 'bg-transparent shadow-none'
          : 'bg-card shadow-[0_18px_36px_-20px_rgba(15,23,42,0.35)] dark:shadow-[0_18px_36px_-20px_rgba(0,0,0,0.8)]',
        active ? 'ring-primary/40' : done ? 'ring-border/70' : 'ring-border'
      )}
    >
      <p
        className={cn(
          'text-sm leading-snug transition-colors duration-500',
          done ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        <span className="sr-only">On other sites you would ask: </span>
        <span className="box-decoration-clone" style={strike}>
          {item.ask}
        </span>
      </p>
      <div className="relative mt-1.5 h-4 overflow-hidden text-[11px] font-medium">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={done ? 'done' : 'sent'}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6, transition: { duration: 0.15 } }}
            transition={{ duration: 0.3, ease: STEP_EASE, delay: done && !reduce ? 0.25 : 0 }}
            className={cn(
              'flex items-center gap-1',
              done ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {done ? (
              <>
                <Check className="size-3" strokeWidth={2.5} aria-hidden />
                No need to ask
              </>
            ) : (
              item.sentAt
            )}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Dashed until the message is absorbed, then a solid line draws into the card edge. */
function Wire({
  item,
  done,
  active,
  reduce,
}: {
  item: Item;
  done: boolean;
  active: boolean;
  reduce: boolean;
}) {
  const left = item.side === 'left';
  return (
    <span aria-hidden className={cn('relative h-px shrink-0', item.reach)}>
      <span className="border-border absolute inset-x-0 top-0 border-t border-dashed" />
      <motion.span
        initial={false}
        animate={{ scaleX: done ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 0.45, ease: STEP_EASE }}
        className={cn(
          'absolute inset-0 transition-colors duration-300',
          active ? 'bg-primary' : 'bg-primary/70',
          left ? 'origin-left' : 'origin-right'
        )}
      />
      <span
        className={cn(
          'absolute top-1/2 size-2 -translate-y-1/2 rounded-full transition-colors delay-200 duration-300',
          left ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2',
          done ? 'bg-primary' : 'bg-border'
        )}
      />
    </span>
  );
}

function RemainingPill({ left, reduce }: { left: number; reduce: boolean }) {
  const clear = left === 0;
  return (
    <span
      className={cn(
        'relative inline-flex h-7 shrink-0 items-center overflow-hidden rounded-full px-3 text-xs font-semibold tabular-nums transition-colors duration-500',
        clear ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={left}
          initial={reduce ? false : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? undefined : { y: -12, opacity: 0 }}
          transition={{ duration: 0.3, ease: STEP_EASE }}
          className="inline-flex items-center gap-1.5"
        >
          {clear ? (
            <>
              <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
              Nothing to send
            </>
          ) : (
            <span>
              {left}
              <span className="hidden sm:inline"> {left === 1 ? 'message' : 'messages'}</span> to
              send
            </span>
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function FindStayCta() {
  return (
    <Link
      to="/properties"
      className="bg-primary-strong text-primary-foreground focus-visible:ring-ring group inline-flex h-12 items-center gap-3 rounded-full pl-6 pr-1.5 text-[15px] font-semibold outline-none transition-transform duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
    >
      Find a stay
      <span className="flex size-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-0.5">
        <ArrowRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
