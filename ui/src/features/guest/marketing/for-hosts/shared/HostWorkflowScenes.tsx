import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';

import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  type TargetAndTransition,
} from 'framer-motion';
import {
  Bell,
  BookOpen,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileCheck2,
  FileText,
  Loader2,
  Mail,
  MousePointer2,
  Paperclip,
  ParkingSquare,
  PawPrint,
  Receipt,
  Sparkles,
  Star,
  Ticket,
  Wallet,
} from 'lucide-react';

import {
  v3Workflow,
  v3WorkflowScenes,
} from '@/features/guest/marketing/for-hosts/shared/hostDemoData';

import { cn } from '@/lib/utils';

/**
 * One short animated scene per workflow step. Each scene plays once on mount (~2.5s) and rests
 * on its final frame, so the canvas shows the step happening rather than restating it in words.
 * Under reduced motion every scene renders its final frame directly.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const { review, documents, checkin, stay, deposit, done } = v3WorkflowScenes;
const { sampleGuest } = v3Workflow;

const SURFACE =
  'border-border bg-card rounded-2xl border shadow-[0_12px_32px_-18px_hsl(var(--shadow-color)/0.35)]';

/** Animation props that start at `delay` seconds, or jump straight to the end state. */
function useCue() {
  const reduce = useReducedMotion();
  return (
    delay: number,
    from: TargetAndTransition = { opacity: 0, y: 10 },
    to: TargetAndTransition = { opacity: 1, y: 0 },
    duration = 0.45
  ) =>
    reduce
      ? { initial: false as const, animate: to }
      : { initial: from, animate: to, transition: { delay, duration, ease: EASE } };
}

/** Flips to true after `ms` (immediately under reduced motion). Drives label swaps in a scene. */
function useAfter(ms: number) {
  const reduce = useReducedMotion();
  const [on, setOn] = useState(Boolean(reduce));

  useEffect(() => {
    if (reduce) {
      setOn(true);
      return;
    }
    const id = window.setTimeout(() => setOn(true), ms);
    return () => window.clearTimeout(id);
  }, [ms, reduce]);

  return on;
}

function Initials({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        'bg-primary/10 text-brand-ink flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        className
      )}
    >
      {value}
    </span>
  );
}

/** A small object that slides along a dashed track between two nodes. */
function Packet({
  direction,
  delay,
  className,
  children,
}: {
  direction: 'out' | 'back';
  delay: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const path = direction === 'out' ? ['0%', '100%'] : ['100%', '0%'];

  return (
    <motion.span
      className={cn(
        'absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-md',
        className
      )}
      initial={{ left: path[0], opacity: 0 }}
      animate={{ left: path, opacity: [0, 1, 1, 0] }}
      transition={{ delay, duration: 0.9, ease: [0.65, 0, 0.35, 1], times: [0, 0.15, 0.85, 1] }}
    >
      {children}
    </motion.span>
  );
}

function Track({ children }: { children?: ReactNode }) {
  return (
    <div className="relative mx-2 h-10 min-w-[2rem] flex-1 sm:mx-3 sm:min-w-[3.5rem]">
      <span className="border-border absolute inset-x-0 top-1/2 border-t-2 border-dashed" />
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * 1. Review: documents land, AI scans the receipt, the host accepts
 * ---------------------------------------------------------------- */

const REVIEW_ICONS = [FileText, CreditCard, Receipt];

function ReviewScene() {
  const cue = useCue();
  const reduce = useReducedMotion();
  const matched = useAfter(1700);
  const accepted = useAfter(2450);
  const receiptIndex = review.items.length - 1;

  return (
    <div className="w-full max-w-[21rem]">
      <motion.div
        {...cue(0, { opacity: 0, y: 14, scale: 0.98 }, { opacity: 1, y: 0, scale: 1 })}
        className={cn(SURFACE, 'overflow-hidden')}
      >
        <div className="border-border flex items-center gap-2 border-b px-3.5 py-2.5">
          <span className="relative flex h-2 w-2">
            {!reduce && !accepted ? (
              <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
            ) : null}
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full transition-colors duration-300',
                accepted ? 'bg-success' : 'bg-primary'
              )}
            />
          </span>
          <span className="text-foreground text-xs font-bold">{review.title}</span>
        </div>

        <ul className="divide-border divide-y">
          {review.items.map((item, index) => {
            const Icon = REVIEW_ICONS[index];
            const isReceipt = index === receiptIndex;
            return (
              <motion.li
                key={item.label}
                {...cue(0.2 + index * 0.14, { opacity: 0, x: -10 }, { opacity: 1, x: 0 })}
                className="relative flex items-center gap-3 overflow-hidden px-3.5 py-2.5"
              >
                <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="text-foreground text-xs font-semibold">{item.label}</span>
                <span className="ml-auto flex h-5 items-center">
                  {isReceipt ? (
                    <AnimatePresence mode="wait" initial={false}>
                      {matched ? (
                        <motion.span
                          key="matched"
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.25, ease: EASE }}
                          className="bg-primary/10 text-brand-ink flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        >
                          <Sparkles className="h-3 w-3" />
                          {review.matched}
                        </motion.span>
                      ) : (
                        <motion.span
                          key="amount"
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.15 }}
                          className="text-muted-foreground text-[11px] font-semibold tabular-nums"
                        >
                          {item.meta}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  ) : (
                    <span className="text-muted-foreground text-[11px] font-semibold">
                      {item.meta}
                    </span>
                  )}
                </span>
                {isReceipt && !reduce ? (
                  <motion.span
                    className="via-primary/15 pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent to-transparent"
                    initial={{ x: '-100%', opacity: 0 }}
                    animate={{ x: ['-100%', '220%'], opacity: [0, 1, 1, 0] }}
                    transition={{ delay: 0.9, duration: 0.8, ease: 'easeInOut' }}
                  />
                ) : null}
              </motion.li>
            );
          })}
        </ul>

        <div className="border-border bg-muted/40 flex justify-end border-t px-3.5 py-2.5">
          <div className="relative">
            <motion.span
              {...cue(2.3, { scale: 1 }, { scale: [1, 0.94, 1] }, 0.3)}
              // White text needs the darker fill to meet AA; the label and check mark the change.
              className="bg-primary-strong flex h-8 min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold text-white"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={accepted ? 'done' : 'idle'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-1.5"
                >
                  {accepted ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
                  {accepted ? review.accepted : review.accept}
                </motion.span>
              </AnimatePresence>
            </motion.span>
            {!reduce ? (
              <motion.span
                className="text-foreground pointer-events-none absolute left-1/2 top-1/2"
                initial={{ x: 64, y: 44, opacity: 0 }}
                animate={{ x: 6, y: 4, opacity: [0, 1, 1, 0] }}
                transition={{ delay: 1.75, duration: 1.3, ease: EASE, times: [0, 0.2, 0.85, 1] }}
              >
                <MousePointer2 className="h-5 w-5 fill-white drop-shadow" strokeWidth={1.75} />
              </motion.span>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * 2. Documents: forms go out to the building admin and come back approved
 * ---------------------------------------------------------------- */

const DOCUMENT_ICONS = [FileText, ParkingSquare, PawPrint];
/** Requests leave one by one, the admin reviews, then approved copies travel back. */
const DOC_SENT_MS = [500, 650, 800] as const;
const DOC_REVIEW_MS = 1400;
const DOC_REPLY_MS = 1950;
const DOC_APPROVED_MS = [2900, 3050, 3200] as const;
const DOC_TRAVEL_S = 0.9;

/** How many of `times` (ms) have passed; all of them under reduced motion. */
function useMilestones(times: readonly number[]) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(reduce ? times.length : 0);

  useEffect(() => {
    if (reduce) {
      setCount(times.length);
      return;
    }
    const ids = times.map((ms, index) =>
      window.setTimeout(() => setCount((current) => Math.max(current, index + 1)), ms)
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [reduce, times]);

  return count;
}

/** One direction of the two-way exchange: a dashed lane, an arrow head, and its packets. */
function Lane({
  label,
  direction,
  children,
}: {
  label: string;
  direction: 'out' | 'back';
  children?: ReactNode;
}) {
  const Arrow = direction === 'out' ? ChevronRight : ChevronLeft;
  return (
    <div>
      <p className="text-muted-foreground text-center text-[9px] font-semibold leading-none">
        {label}
      </p>
      <div className="relative mt-1 h-8">
        <span
          className={cn(
            'absolute inset-x-0 top-1/2 border-t-2 border-dashed',
            direction === 'out' ? 'border-primary/40' : 'border-success/50'
          )}
        />
        <Arrow
          className={cn(
            'absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2',
            direction === 'out' ? 'text-primary -right-1' : 'text-success -left-1'
          )}
          strokeWidth={3}
        />
        {children}
      </div>
    </div>
  );
}

function DocumentsScene() {
  const cue = useCue();
  const reduce = useReducedMotion();
  const sent = useMilestones(DOC_SENT_MS);
  const approved = useMilestones(DOC_APPROVED_MS);
  const reviewing = useAfter(DOC_REVIEW_MS);
  const replied = useAfter(DOC_REPLY_MS);

  return (
    <div className="flex w-full max-w-[27rem] items-center">
      <div className="w-[7.5rem] shrink-0 space-y-2 sm:w-[12rem]">
        {documents.files.map((file, index) => {
          const Icon = DOCUMENT_ICONS[index];
          const state = index < approved ? 'approved' : index < sent ? 'sent' : 'idle';
          return (
            <motion.div
              key={file}
              {...cue(0.05 + index * 0.1, { opacity: 0, x: -12 }, { opacity: 1, x: 0 })}
              className={cn(
                SURFACE,
                'flex items-center gap-2 px-2.5 py-2.5 transition-colors duration-300 sm:px-3',
                state === 'approved' && 'border-success/40'
              )}
            >
              <Icon className="text-primary h-4 w-4 shrink-0" />
              <span className="text-foreground whitespace-nowrap text-xs font-semibold">
                {file}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                {state === 'idle' ? null : (
                  <motion.span
                    key={state}
                    initial={
                      reduce
                        ? false
                        : state === 'approved'
                          ? { opacity: 0, scale: 1.6, rotate: -12 }
                          : { opacity: 0, x: 6 }
                    }
                    animate={{ opacity: 1, scale: 1, rotate: 0, x: 0 }}
                    exit={reduce ? undefined : { opacity: 0, x: 6 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    title={state === 'approved' ? documents.approved : documents.sent}
                    className={cn(
                      'ml-auto flex h-4 shrink-0 items-center gap-1 rounded-full text-[10px] font-semibold sm:h-5 sm:px-1.5',
                      state === 'approved'
                        ? 'bg-success text-white max-sm:w-4 max-sm:justify-center'
                        : 'bg-muted text-muted-foreground max-sm:w-4 max-sm:justify-center'
                    )}
                  >
                    {state === 'approved' ? (
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    ) : (
                      <Mail className="h-2.5 w-2.5" />
                    )}
                    <span className="hidden sm:inline">
                      {state === 'approved' ? documents.approved : documents.sent}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <div className="mx-2 flex min-w-[3.25rem] flex-1 flex-col gap-2.5 sm:mx-3 sm:min-w-[4.5rem]">
        <Lane label={documents.out} direction="out">
          {DOC_SENT_MS.map((ms) => (
            <Packet
              key={ms}
              direction="out"
              delay={ms / 1000}
              className="bg-primary-strong h-7 w-7 text-white"
            >
              <Mail className="h-3.5 w-3.5" />
            </Packet>
          ))}
        </Lane>
        <Lane label={documents.back} direction="back">
          {DOC_APPROVED_MS.map((ms) => (
            <Packet
              key={ms}
              direction="back"
              delay={ms / 1000 - DOC_TRAVEL_S}
              className="bg-success h-7 w-7 text-white"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
            </Packet>
          ))}
        </Lane>
      </div>

      <motion.div
        {...cue(0.2, { opacity: 0, x: 12 }, { opacity: 1, x: 0 })}
        className="flex w-[4.5rem] shrink-0 flex-col items-center sm:w-20"
      >
        <div className={cn(SURFACE, 'relative flex h-16 w-16 items-center justify-center')}>
          <Building2 className="text-foreground h-7 w-7" strokeWidth={1.5} />
          {!reduce
            ? [DOC_REVIEW_MS, DOC_REPLY_MS].map((ms, index) => (
                <motion.span
                  key={ms}
                  className={cn(
                    'absolute inset-0 rounded-2xl ring-2',
                    index === 0 ? 'ring-primary' : 'ring-success'
                  )}
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0, 0.9, 0], scale: [1, 1.12, 1.22] }}
                  transition={{ delay: ms / 1000, duration: 0.7 }}
                />
              ))
            : null}
        </div>
        <p className="text-muted-foreground mt-2 text-center text-[10px] font-semibold leading-tight">
          {documents.admin}
        </p>
        <p
          className={cn(
            'mt-1 flex h-4 items-center gap-1 text-[10px] font-semibold transition-colors duration-300',
            replied ? 'text-brand-ink' : 'text-muted-foreground',
            !reviewing && 'invisible'
          )}
        >
          {replied ? (
            <Check className="h-3 w-3" strokeWidth={3} />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {replied ? documents.replied : documents.reviewing}
        </p>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * 3. Check-in: the confirmation goes out with everything the guest needs
 * ---------------------------------------------------------------- */

function CheckinScene() {
  const cue = useCue();
  const sent = useAfter(950);

  return (
    <motion.div
      {...cue(0, { opacity: 0, y: 16, scale: 0.98 }, { opacity: 1, y: 0, scale: 1 })}
      className={cn(SURFACE, 'w-full max-w-[21rem] overflow-hidden')}
    >
      <div className="border-border flex items-center gap-2.5 border-b px-3.5 py-2.5">
        <span className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <Mail className="h-3.5 w-3.5" />
        </span>
        <span className="text-muted-foreground min-w-0 truncate text-[11px]">
          To <span className="text-foreground font-semibold">{checkin.to}</span>
        </span>
        <span
          className={cn(
            'ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors duration-300',
            sent ? 'bg-success/10 text-brand-ink' : 'bg-muted text-muted-foreground'
          )}
        >
          {sent ? (
            <Check className="h-3 w-3" strokeWidth={3} />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {sent ? checkin.sent : checkin.sending}
        </span>
      </div>

      <div className="p-3.5">
        <motion.p
          {...cue(1.05, { opacity: 0, y: 6 })}
          className="text-foreground text-sm font-bold"
        >
          {checkin.title}
        </motion.p>
        <dl className="mt-2.5 grid grid-cols-2 gap-1.5">
          {checkin.rows.map((row, index) => (
            <motion.div
              key={row.label}
              {...cue(1.2 + index * 0.1, { opacity: 0, y: 6 })}
              className="bg-muted/60 rounded-lg px-2.5 py-1.5"
            >
              <dt className="text-muted-foreground text-[10px]">{row.label}</dt>
              <dd className="text-foreground text-xs font-semibold tabular-nums">{row.value}</dd>
            </motion.div>
          ))}
        </dl>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {checkin.attachments.map((file, index) => (
            <motion.li
              key={file}
              {...cue(
                1.6 + index * 0.12,
                { opacity: 0, scale: 0.9 },
                { opacity: 1, scale: 1 },
                0.3
              )}
              className="border-border text-foreground flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold"
            >
              <Paperclip className="text-muted-foreground h-3 w-3" />
              {file}
            </motion.li>
          ))}
        </ul>
        <motion.span
          {...cue(2.0, { opacity: 0, y: 6 })}
          className="bg-primary-strong mt-3 flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-white"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {checkin.cta}
        </motion.span>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- *
 * 4. Stay: the stay moves day by day; the balance settles, the check-out email goes out
 * ---------------------------------------------------------------- */

const STAY_TRACK_START = 0.4;
const STAY_TRACK_DURATION = 1.9;
const STAY_EVENT_ICONS = [Receipt, Mail];

function StayScene() {
  const cue = useCue();
  const reduce = useReducedMotion();
  const midStay = useAfter(1100);
  const lastDay = useAfter(2150);
  const phase = lastDay ? 2 : midStay ? 1 : 0;
  const lastIndex = stay.days.length - 1;
  /** Seconds at which the moving fill reaches a given day dot. */
  const reachAt = (index: number) => STAY_TRACK_START + (index / lastIndex) * STAY_TRACK_DURATION;

  return (
    <div className={cn(SURFACE, 'w-full max-w-[21rem] overflow-hidden')}>
      <div className="border-border flex items-center gap-2 border-b px-3.5 py-2.5">
        <span className="text-foreground text-xs font-bold">{stay.range}</span>
        <span className="ml-auto flex h-5 items-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="bg-primary/10 text-brand-ink rounded-full px-2 py-0.5 text-[10px] font-semibold"
            >
              {stay.phases[phase]}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>

      <div className="px-5 pt-4">
        <div className="relative">
          <span className="bg-border absolute left-2 right-2 top-[7px] h-0.5" />
          <motion.span
            className="bg-primary absolute left-2 right-2 top-[7px] h-0.5 origin-left"
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: STAY_TRACK_START, duration: STAY_TRACK_DURATION, ease: 'linear' }}
          />
          <div className="relative flex justify-between">
            {stay.days.map((day, index) => (
              <div key={day} className="flex flex-col items-center gap-1">
                <span className="border-border bg-card relative h-4 w-4 rounded-full border-2">
                  <motion.span
                    className="bg-primary absolute -inset-0.5 rounded-full"
                    {...cue(reachAt(index), { scale: 0 }, { scale: 1 }, 0.25)}
                  />
                </span>
                <span className="text-muted-foreground text-[10px] font-semibold tabular-nums">
                  {day}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ul className="space-y-2 p-3.5 pt-3">
        {stay.events.map((event, index) => {
          const Icon = STAY_EVENT_ICONS[index];
          return (
            <motion.li
              key={event.title}
              {...cue(index === 0 ? 0.6 : reachAt(lastIndex) + 0.1, { opacity: 0, y: 8 })}
              className="bg-muted/50 flex items-center gap-2.5 rounded-xl px-3 py-2"
            >
              <span className="bg-success/10 text-success flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="text-foreground block text-xs font-semibold">{event.title}</span>
                <span className="text-muted-foreground block truncate text-[10px]">
                  {event.meta}
                </span>
              </span>
              <span className="text-muted-foreground ml-auto shrink-0 text-[10px] font-semibold">
                {event.when}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * 5. Deposit: the reminder fires, the deposit goes back to the guest
 * ---------------------------------------------------------------- */

function DepositScene() {
  const cue = useCue();
  const refunded = useAfter(2150);

  return (
    <div className="w-full max-w-[21rem]">
      <motion.div
        {...cue(0.1, { opacity: 0, y: -12 })}
        className={cn(SURFACE, 'flex items-center gap-2.5 px-3 py-2.5')}
      >
        <motion.span
          {...cue(0.45, { rotate: 0 }, { rotate: [0, -16, 14, -10, 6, 0] }, 0.7)}
          className="bg-warning/15 text-warning-foreground dark:text-warning flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        >
          <Bell className="h-3.5 w-3.5" />
        </motion.span>
        <span className="text-foreground text-xs font-semibold">{deposit.reminder}</span>
      </motion.div>

      <div className="mt-6 flex items-center">
        <motion.div {...cue(0.5)} className="flex w-14 shrink-0 flex-col items-center">
          <span className="bg-muted text-foreground flex h-11 w-11 items-center justify-center rounded-full">
            <Wallet className="h-4 w-4" />
          </span>
        </motion.div>
        <Track>
          <Packet
            direction="out"
            delay={1.2}
            className="bg-primary-strong h-7 px-2.5 text-[11px] font-bold text-white"
          >
            {deposit.amount}
          </Packet>
        </Track>
        <motion.div {...cue(0.6)} className="relative flex w-14 shrink-0 flex-col items-center">
          <Initials value={sampleGuest.initials} className="h-11 w-11 text-[11px]" />
          <motion.span
            {...cue(2.1, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1 }, 0.3)}
            className="bg-success absolute -right-0.5 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-[hsl(var(--card))]"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </motion.span>
        </motion.div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
        <span className="text-muted-foreground flex w-14 justify-center">{deposit.from}</span>
        <span
          className={cn(
            'flex w-14 whitespace-nowrap transition-colors duration-300',
            // The refunded label is wider than its column: grow left so it is not clipped.
            refunded ? 'text-brand-ink justify-end' : 'text-muted-foreground justify-center'
          )}
        >
          {refunded ? `${deposit.done} ${deposit.amount}` : deposit.to}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * 6. Done: the stay posts to finance, the guest gets a review ask and a voucher
 * ---------------------------------------------------------------- */

function LedgerRow({
  name,
  meta,
  amount,
  status,
  className,
}: {
  name: string;
  meta: string;
  amount: string;
  status?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5 px-3.5 py-2.5', className)}>
      <Initials
        value={name
          .split(' ')
          .map((part) => part[0])
          .join('')}
        className="h-7 w-7 text-[10px]"
      />
      <span className="min-w-0">
        <span className="text-foreground block truncate text-xs font-semibold">{name}</span>
        <span className="text-muted-foreground block text-[10px] tabular-nums">{meta}</span>
      </span>
      <span className="ml-auto flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-brand-ink text-xs font-bold tabular-nums">{amount}</span>
        {status ? <span className="text-muted-foreground text-[10px]">{status}</span> : null}
      </span>
    </div>
  );
}

function DoneScene() {
  const cue = useCue();
  const reduce = useReducedMotion();
  const { previous, entry, trip } = done;

  return (
    <div className="w-full max-w-[21rem] space-y-3">
      <motion.div {...cue(0)} className={cn(SURFACE, 'overflow-hidden')}>
        <div className="border-border flex items-center gap-2 border-b px-3.5 py-2.5">
          <Wallet className="text-primary h-3.5 w-3.5" />
          <span className="text-foreground text-xs font-bold">{done.finance}</span>
        </div>
        {/* Grid rows instead of `height: auto`: framer re-pins the window scroll while it
            measures an auto height, which cuts a smooth section jump short mid-page. */}
        <motion.div
          className="grid"
          initial={reduce ? false : { gridTemplateRows: '0fr', opacity: 0 }}
          animate={{ gridTemplateRows: '1fr', opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5, ease: EASE }}
        >
          <motion.div
            className="min-h-0 overflow-hidden"
            initial={reduce ? false : { backgroundColor: 'hsl(var(--primary) / 0.08)' }}
            animate={{ backgroundColor: 'hsl(var(--primary) / 0)' }}
            transition={{ delay: 1.3, duration: 0.8 }}
          >
            <LedgerRow {...entry} status={done.status} />
          </motion.div>
        </motion.div>
        <LedgerRow {...previous} status={done.status} className="border-border border-t" />
      </motion.div>

      <motion.div {...cue(1.1, { opacity: 0, y: 12 })} className={cn(SURFACE, 'px-3.5 py-3')}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-foreground text-xs font-bold">{trip.title}</p>
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((star) => (
              <motion.span
                key={star}
                {...cue(
                  1.45 + star * 0.08,
                  { opacity: 0.25, scale: 0.6 },
                  { opacity: 1, scale: 1 },
                  0.25
                )}
                className="text-warning inline-flex"
              >
                <Star className="h-3.5 w-3.5 fill-current" />
              </motion.span>
            ))}
          </div>
        </div>
        <motion.p
          {...cue(2.0, { opacity: 0, y: 6 })}
          className="border-primary/40 bg-primary/5 text-brand-ink mt-2.5 flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-[11px] font-semibold"
        >
          <Ticket className="h-3.5 w-3.5 shrink-0" />
          {trip.voucher}
        </motion.p>
      </motion.div>
    </div>
  );
}

const SCENES: ComponentType[] = [
  ReviewScene,
  DocumentsScene,
  CheckinScene,
  StayScene,
  DepositScene,
  DoneScene,
];

export function WorkflowScene({ index }: { index: number }) {
  const Scene = SCENES[index];
  return <Scene />;
}

/** Phone / tablet: a compact canvas that plays its scene the first time it scrolls into view. */
export function InViewWorkflowScene({ index }: { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });

  return (
    <div
      ref={ref}
      aria-hidden
      className="border-border bg-card mt-4 flex min-h-[16.5rem] items-center justify-center overflow-hidden rounded-2xl border px-4 py-6 [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px]"
    >
      {inView ? <WorkflowScene index={index} /> : null}
    </div>
  );
}
