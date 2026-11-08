import { type ComponentType } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  Car,
  Check,
  KeyRound,
  MapPin,
  Mic,
  Search,
  SendHorizontal,
  Sparkles,
  Wallet,
} from 'lucide-react';

import { GuestShowcaseCompareScene } from '@/features/guest/auth/components/GuestShowcaseCompareScene';
import { GuestShowcasePerksScene } from '@/features/guest/auth/components/GuestShowcasePerksScene';
import {
  Avatar,
  MockCard,
  SceneFrame,
  TapPulse,
  Thumb,
} from '@/features/guest/auth/components/GuestShowcaseSceneKit';
import { GuestShowcaseGuideScene } from '@/features/guest/auth/components/GuestShowcaseStayScenes';
import { GuestShowcaseVoiceCall } from '@/features/guest/auth/components/GuestShowcaseVoiceCall';
import {
  useCountUp,
  useShowcaseSteps,
  useTypewriter,
} from '@/features/guest/auth/hooks/useShowcaseTimeline';
import type { GuestShowcaseChapterId } from '@/features/guest/auth/lib/guestShowcaseChapters';
import {
  SHOWCASE_EASE,
  SWAP,
  formatPeso,
  pop,
  rise,
} from '@/features/guest/auth/lib/guestShowcaseMotion';

import { cn } from '@/lib/utils';

/* -------------------------------- Search -------------------------------- */

const SEARCH_QUERY = 'beach condo for 4';
const SEARCH_RESULTS = [
  { name: 'Sunset 1BR Condo', place: 'Boracay', price: 3200, hue: 18, pin: { x: 30, y: 30 } },
  { name: 'Shoreline Studio', place: 'La Union', price: 2450, hue: 190, pin: { x: 42, y: 44 } },
  { name: 'Bayside Loft', place: 'Cebu', price: 2980, hue: 150, pin: { x: 16, y: 82 } },
] as const;

function SearchMap({ active }: { active: number }) {
  return (
    <div
      aria-hidden
      className="border-border/70 @[420px]:block relative hidden overflow-hidden rounded-lg border"
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <rect
          width="100"
          height="100"
          className="fill-[hsl(195_60%_87%)] dark:fill-[hsl(200_35%_17%)]"
        />
        <path
          d="M0 0H64C57 16 72 30 60 46C49 61 31 58 24 74C18 87 22 100 22 100H0Z"
          className="fill-[hsl(95_30%_85%)] dark:fill-[hsl(150_14%_23%)]"
        />
        <path
          d="M100 50C85 55 77 69 83 83C87 93 79 100 79 100H100Z"
          className="fill-[hsl(95_30%_85%)] dark:fill-[hsl(150_14%_23%)]"
        />
        <path
          d="M6 0C14 24 26 38 46 36M0 62C12 58 22 52 30 40"
          fill="none"
          vectorEffect="non-scaling-stroke"
          className="stroke-white/90 dark:stroke-white/10"
          strokeWidth={2}
        />
      </svg>
      {SEARCH_RESULTS.map((result, index) => {
        const isActive = index === active;
        return (
          <motion.span
            key={result.name}
            className={cn('absolute', isActive && 'z-10')}
            style={{ left: `${result.pin.x}%`, top: `${result.pin.y}%` }}
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.1 + index * 0.12 }}
          >
            <span
              className={cn(
                'relative block -translate-x-1/2 -translate-y-full rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums shadow-md transition-all duration-300',
                isActive
                  ? 'bg-primary-strong text-primary-foreground scale-110'
                  : 'bg-card text-foreground'
              )}
            >
              ₱{(result.price / 1000).toFixed(1)}k
              <span
                className={cn(
                  'absolute left-1/2 top-full size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 transition-colors duration-300',
                  isActive ? 'bg-primary-strong' : 'bg-card'
                )}
              />
            </span>
          </motion.span>
        );
      })}
    </div>
  );
}

function SearchScene() {
  const { typed, done } = useTypewriter(SEARCH_QUERY, 250, 50);
  // tap Search, intent chips, results, then walk the results so the map follows along
  const step = useShowcaseSteps([1250, 1500, 1750, 3000, 4100, 5200]);
  const active = step >= 4 ? (step - 4) % SEARCH_RESULTS.length : -1;

  return (
    <SceneFrame>
      <MockCard className="flex items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5">
        <Search className="text-primary size-3.5 shrink-0" aria-hidden />
        <span className="text-foreground @[420px]:text-xs min-w-0 flex-1 truncate text-[11px] font-medium">
          {typed}
          <span
            aria-hidden
            className={cn(
              'bg-primary ml-px inline-block h-3 w-px translate-y-0.5',
              done && 'animate-pulse'
            )}
          />
        </span>
        <span className="bg-primary-strong text-primary-foreground relative rounded-full px-2.5 py-1 text-[10px] font-semibold">
          Search
          <TapPulse atMs={1250} />
        </span>
      </MockCard>

      <div className="flex min-h-[20px] flex-wrap items-center gap-1">
        {step >= 2
          ? ['Beach', 'Condo', '4 guests'].map((chip, index) => (
              <motion.span
                key={chip}
                {...pop(index * 0.07)}
                className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              >
                <Sparkles className="size-2.5" aria-hidden />
                {chip}
              </motion.span>
            ))
          : null}
        {step >= 3 ? (
          <motion.span {...rise(0.1, 0)} className="text-muted-foreground ml-auto text-[10px]">
            3 matches
          </motion.span>
        ) : null}
      </div>

      <div className="@[420px]:grid-cols-[1.35fr_1fr] grid min-h-0 flex-1 grid-cols-1 gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          {step >= 3
            ? SEARCH_RESULTS.map((result, index) => {
                const isActive = index === active;
                return (
                  <motion.div key={result.name} {...rise(index * 0.1)}>
                    <MockCard
                      className={cn(
                        'flex items-center gap-2 p-1.5 transition-all duration-300',
                        isActive && 'border-primary/60 bg-primary/[0.04] -translate-y-px shadow-md'
                      )}
                    >
                      <Thumb hue={result.hue} className="@[420px]:size-9 size-8" />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block truncate text-[11px] font-semibold">
                          {result.name}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
                          <MapPin className="size-2.5" aria-hidden />
                          {result.place}
                        </span>
                      </span>
                      <span className="text-foreground text-[11px] font-bold tabular-nums">
                        {formatPeso(result.price)}
                        <span className="text-muted-foreground text-[9px] font-normal">/night</span>
                      </span>
                    </MockCard>
                  </motion.div>
                );
              })
            : null}
        </div>
        {step >= 3 ? <SearchMap active={active} /> : null}
      </div>
    </SceneFrame>
  );
}

/* --------------------------------- Book --------------------------------- */

const MONTH_OFFSET = 1; // Dec 1 sits on a Monday in this mock month.
const RANGE_START = 9;
const RANGE_END = 12;
const BOOKED = [5, 6, 19, 20, 21];
const NIGHTLY = 3200;
const NIGHTS = RANGE_END - RANGE_START;

function CalendarDay({ day, step }: { day: number; step: number }) {
  const isStart = day === RANGE_START;
  const isEnd = day === RANGE_END;
  const inRange = day >= RANGE_START && day <= RANGE_END;
  const booked = BOOKED.includes(day);
  const selected = (isStart && step >= 1) || (isEnd && step >= 3);
  const showBand = inRange && step >= 2;
  const midRange = showBand && !isStart && !isEnd;

  return (
    <span className="@[420px]:h-[22px] relative flex h-[18px] items-center justify-center">
      {showBand ? (
        <motion.span
          aria-hidden
          className="bg-primary/15 absolute inset-y-[1px] origin-left"
          style={{ left: isStart ? '50%' : 0, right: isEnd ? '50%' : 0 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.16, delay: (day - RANGE_START) * 0.09, ease: 'linear' }}
        />
      ) : null}
      <span className="relative flex aspect-square h-full items-center justify-center rounded-full">
        {selected ? (
          <motion.span
            aria-hidden
            className="bg-primary-strong absolute inset-0 rounded-full"
            {...pop(0)}
          />
        ) : null}
        <span
          className={cn(
            'relative text-[10px] tabular-nums',
            booked
              ? 'text-muted-foreground/50 line-through'
              : selected
                ? 'text-primary-foreground font-bold'
                : midRange
                  ? 'text-primary font-semibold'
                  : 'text-foreground'
          )}
        >
          {day}
        </span>
        {isStart ? <TapPulse atMs={600} /> : null}
        {isEnd ? <TapPulse atMs={1500} /> : null}
      </span>
    </span>
  );
}

function ReserveButton({ step, className }: { step: number; className?: string }) {
  const requested = step >= 5;
  return (
    <span
      className={cn(
        'relative flex items-center justify-center rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors duration-300',
        requested ? 'bg-primary/10 text-primary' : 'bg-primary-strong text-primary-foreground',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={requested ? 'done' : 'idle'}
          {...SWAP}
          className="flex items-center gap-1"
        >
          {requested ? (
            <>
              <Check className="size-3" strokeWidth={3} aria-hidden /> Requested
            </>
          ) : (
            'Reserve'
          )}
        </motion.span>
      </AnimatePresence>
      <TapPulse atMs={2700} />
    </span>
  );
}

function BookScene() {
  // start date, band sweep, end date, totals, Reserve tapped, host notified
  const step = useShowcaseSteps([600, 1000, 1500, 1800, 3000, 3400]);
  const nights = useCountUp(NIGHTS, 1700, 450);
  const total = useCountUp(NIGHTS * NIGHTLY, 1700, 650);
  const deposit = useCountUp(2880, 1850, 650);

  return (
    <SceneFrame className="@[420px]:flex-row @[420px]:items-center justify-center">
      <MockCard className="@[420px]:flex-1 @[420px]:p-2.5 flex min-w-0 flex-col p-2">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-foreground text-[11px] font-bold">December</p>
          <p className="text-muted-foreground flex items-center gap-1 text-[9px]">
            <span className="bg-muted-foreground/40 h-px w-3" aria-hidden /> Booked
          </p>
        </div>
        <div className="text-muted-foreground grid grid-cols-7 text-center text-[9px] font-semibold">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>
        <div className="mt-0.5 grid grid-cols-7 gap-y-0.5 text-center">
          {Array.from({ length: MONTH_OFFSET }).map((_, index) => (
            <span key={`pad-${index}`} />
          ))}
          {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
            <CalendarDay key={day} day={day} step={step} />
          ))}
        </div>
      </MockCard>

      {/* Phone-width stage: one-line summary bar. */}
      <MockCard className="@[420px]:hidden flex items-center gap-2 px-2.5 py-1.5">
        <span className="min-w-0 flex-1">
          <span className="text-foreground block text-[11px] font-bold tabular-nums">
            {formatPeso(total)}
          </span>
          <span className="text-muted-foreground block text-[10px] tabular-nums">
            Dec 9 to 12 · {nights} nights
          </span>
        </span>
        <ReserveButton step={step} />
      </MockCard>

      {/* Wide stage: price breakdown + host notification. */}
      <div className="@[420px]:flex hidden w-[42%] shrink-0 flex-col justify-center gap-2">
        <MockCard className="space-y-1.5 p-2.5">
          <p className="text-foreground text-[11px] font-bold">Dec 9 to 12</p>
          <div className="text-muted-foreground flex justify-between text-[10px] tabular-nums">
            <span>
              {formatPeso(NIGHTLY)} x {nights} nights
            </span>
            <span>{formatPeso(total)}</span>
          </div>
          <div className="text-muted-foreground flex justify-between text-[10px] tabular-nums">
            <span>Down payment today</span>
            <span className="text-foreground font-semibold">{formatPeso(deposit)}</span>
          </div>
          <div className="border-border/70 text-foreground flex justify-between border-t pt-1.5 text-[11px] font-bold tabular-nums">
            <span>Total</span>
            <span>{formatPeso(total)}</span>
          </div>
          <ReserveButton step={step} className="w-full" />
        </MockCard>
        <div className="min-h-[30px]">
          {step >= 6 ? (
            <motion.div {...rise(0)}>
              <MockCard className="flex items-center gap-1.5 px-2 py-1.5">
                <Avatar initial="M" className="size-5 text-[9px]" />
                <span className="text-foreground text-[10px] font-semibold">
                  Mara got your request
                </span>
              </MockCard>
            </motion.div>
          ) : null}
        </div>
      </div>
    </SceneFrame>
  );
}

/* --------------------------------- Chat --------------------------------- */

const CHAT_STARTERS = ['Is parking available?', 'Can I check in early?', 'Is the pool open?'];
const TAPPED_STARTER = 1;

function ChatScene() {
  // Act 1 (text): starters, tap, sent, seen, typing, reply. Act 2: tap the mic, call opens.
  const step = useShowcaseSteps([200, 800, 1000, 1200, 1300, 2200, 3200]);
  const sent = step >= 3;
  const callOpen = step >= 7;

  return (
    <SceneFrame>
      <MockCard className="flex items-center gap-2 px-2.5 py-1.5">
        <Avatar initial="M" />
        <span className="min-w-0 flex-1">
          <span className="text-foreground block text-[11px] font-semibold">Mara</span>
          <span className="text-muted-foreground block truncate text-[9px]">
            Host · Sunset 1BR Condo
          </span>
        </span>
        <span className="bg-primary/10 text-primary @[420px]:inline hidden rounded-full px-2 py-0.5 text-[9px] font-semibold">
          Talk to receptionist
        </span>
        <span className="relative rounded-full">
          <span className="border-border text-primary flex size-7 items-center justify-center rounded-full border">
            <Mic className="size-3.5" aria-hidden />
          </span>
          <TapPulse atMs={2900} />
        </span>
      </MockCard>

      <div className="relative flex min-h-0 flex-1 flex-col justify-end gap-1">
        <AnimatePresence>
          {!sent ? (
            <motion.div
              key="empty"
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
            >
              <Avatar initial="M" className="size-8 text-xs" />
              <p className="text-foreground text-[11px] font-semibold">Ask Mara anything</p>
              <p className="text-muted-foreground text-[10px]">Pick a question or write your own</p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {sent ? (
          <motion.p
            {...rise(0)}
            className="bg-primary-strong text-primary-foreground max-w-[78%] self-end rounded-2xl rounded-br-sm px-2.5 py-1.5 text-[11px]"
          >
            {CHAT_STARTERS[TAPPED_STARTER]}
          </motion.p>
        ) : null}
        {step >= 4 ? (
          <motion.span {...rise(0, 2)} className="text-muted-foreground self-end text-[9px]">
            Seen
          </motion.span>
        ) : null}
        <AnimatePresence>
          {step >= 5 && step < 6 ? (
            <motion.span
              key="typing"
              aria-hidden
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-card border-border/70 flex h-6 w-11 origin-bottom-left items-center justify-center gap-1 self-start rounded-2xl rounded-bl-sm border"
            >
              {[0, 1, 2].map((dot) => (
                <motion.span
                  key={dot}
                  className="bg-muted-foreground/70 size-1 rounded-full"
                  animate={{ y: [0, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 0.7, delay: dot * 0.12 }}
                />
              ))}
            </motion.span>
          ) : null}
        </AnimatePresence>
        {step >= 6 ? (
          <motion.p
            {...rise(0)}
            className="bg-card border-border/70 text-foreground max-w-[80%] self-start rounded-2xl rounded-bl-sm border px-2.5 py-1.5 text-[11px] shadow-sm"
          >
            Yes, from 12 PM. I added it to your trip.
          </motion.p>
        ) : null}
      </div>

      <div className="min-h-[30px]">
        <AnimatePresence mode="wait" initial={false}>
          {!sent ? (
            <motion.div
              key="starters"
              className="flex flex-wrap justify-center gap-1"
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
            >
              {step >= 1
                ? CHAT_STARTERS.map((starter, index) => (
                    <motion.span
                      key={starter}
                      {...rise(index * 0.06)}
                      className="border-primary/30 bg-card text-foreground relative rounded-full border px-2 py-1 text-[10px] font-medium"
                    >
                      {starter}
                      {index === TAPPED_STARTER ? <TapPulse atMs={800} /> : null}
                    </motion.span>
                  ))
                : null}
            </motion.div>
          ) : (
            <motion.div key="composer" {...rise(0, 6)}>
              <MockCard className="flex items-center gap-2 rounded-full py-1 pl-3 pr-1">
                <span className="text-muted-foreground flex-1 text-[10px]">Message Mara</span>
                <span className="bg-primary-strong text-primary-foreground flex size-5 items-center justify-center rounded-full">
                  <SendHorizontal className="size-2.5" aria-hidden />
                </span>
              </MockCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {callOpen ? <GuestShowcaseVoiceCall /> : null}
    </SceneFrame>
  );
}

/* --------------------------------- Trip --------------------------------- */

const TRIP_STEPS = ['Requested', 'Confirmed', 'Ready', 'Checked out', 'Done'];

function TripRow({
  icon: Icon,
  label,
  value,
  done,
  delay,
}: {
  icon: typeof Car;
  label: string;
  value: string;
  done: boolean;
  delay: number;
}) {
  return (
    <motion.div {...rise(delay)}>
      <MockCard className="flex items-center gap-2 px-2.5 py-1.5">
        <Icon className="text-primary size-3.5 shrink-0" aria-hidden />
        <span className="text-foreground min-w-0 flex-1 truncate text-[11px]">{label}</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={value}
            {...SWAP}
            className={cn(
              'flex items-center gap-1 text-[11px] tabular-nums',
              done ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium'
            )}
          >
            {done ? null : (
              <span className="bg-warning size-1.5 animate-pulse rounded-full" aria-hidden />
            )}
            {value}
          </motion.span>
        </AnimatePresence>
      </MockCard>
    </motion.div>
  );
}

function TripScene() {
  // requested, confirmed, ready, docs approved, parking assigned, next-step banner
  const step = useShowcaseSteps([400, 1000, 1600, 2200, 2700, 3400]);
  const reached = Math.min(step, 3);
  const statusLabel = ['Requested', 'Requested', 'Confirmed', 'Ready'][reached];
  const fill = reached <= 1 ? 0 : ((reached - 1) / (TRIP_STEPS.length - 1)) * 100;

  return (
    <SceneFrame className="justify-center">
      <MockCard className="flex items-center gap-2 p-2">
        <Thumb hue={18} className="size-9" />
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-[11px] font-bold">
            Sunset 1BR Condo
          </span>
          <span className="text-muted-foreground block text-[10px]">Dec 9 to 12 · 2 guests</span>
        </span>
        <span className="bg-primary/10 text-primary overflow-hidden rounded-full px-2 py-0.5 text-[10px] font-semibold">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={statusLabel} {...SWAP} className="block">
              {statusLabel}
            </motion.span>
          </AnimatePresence>
        </span>
      </MockCard>

      <MockCard className="px-2.5 pb-2 pt-2.5">
        <div className="relative mx-6 flex justify-between">
          <div className="bg-muted absolute inset-x-0 top-[7px] h-0.5 rounded-full" aria-hidden />
          <motion.div
            aria-hidden
            className="bg-primary absolute left-0 top-[7px] h-0.5 rounded-full"
            initial={false}
            animate={{ width: `${fill}%` }}
            transition={{ duration: 0.5, ease: SHOWCASE_EASE }}
          />
          {TRIP_STEPS.map((label, index) => {
            const isReached = index < reached;
            return (
              <span key={label} className="relative z-10 flex w-0 flex-col items-center">
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full border-2 transition-all duration-300',
                    isReached
                      ? 'border-primary-strong bg-primary-strong text-primary-foreground'
                      : 'border-muted bg-card scale-90'
                  )}
                >
                  {isReached ? (
                    <motion.span {...pop(0)}>
                      <Check className="size-2.5" strokeWidth={3} aria-hidden />
                    </motion.span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'mt-1 whitespace-nowrap text-[9px] transition-colors duration-300',
                    isReached ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </span>
            );
          })}
        </div>
      </MockCard>

      <div className="flex flex-col gap-1.5">
        <TripRow
          icon={BadgeCheck}
          label="Building documents"
          value={step >= 4 ? 'Approved' : 'In review'}
          done={step >= 4}
          delay={0.5}
        />
        <TripRow
          icon={Car}
          label="Parking slot"
          value={step >= 5 ? 'P2-14' : 'Assigning'}
          done={step >= 5}
          delay={0.65}
        />
        <TripRow icon={Wallet} label="Balance due Dec 9" value="₱6,720" done delay={0.8} />
      </div>

      <div className="@[420px]:block hidden min-h-[30px]">
        {step >= 6 ? (
          <motion.div
            {...rise(0)}
            className="bg-primary-strong text-primary-foreground flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
          >
            <KeyRound className="size-3.5" aria-hidden />
            Next: check in Tue, Dec 9 from 2 PM
          </motion.div>
        ) : null}
      </div>
    </SceneFrame>
  );
}

/* ------------------------------- Registry ------------------------------- */

const SCENES: Record<GuestShowcaseChapterId, ComponentType> = {
  search: SearchScene,
  book: BookScene,
  chat: ChatScene,
  trip: TripScene,
  guide: GuestShowcaseGuideScene,
  perks: GuestShowcasePerksScene,
  compare: GuestShowcaseCompareScene,
};

export function GuestShowcaseScene({ id }: { id: GuestShowcaseChapterId }) {
  const Scene = SCENES[id];
  return <Scene />;
}
