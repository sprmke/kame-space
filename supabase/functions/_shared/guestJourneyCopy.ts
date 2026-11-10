/**
 * Guest-facing vocabulary for a booking: the status word, the one thing to do next, and the
 * review expectation.
 *
 * One source of truth for every guest surface (trip page, account list, emails, chat card,
 * host dashboard). The UI mirror lives in
 * `ui/src/features/guest/trip/lib/guestJourneyCopy.ts`; a parity test asserts the two agree.
 *
 * Rules (plan §3.3):
 * - `PENDING_REVIEW` is never "Confirmed" / "Approved" / "Booked".
 * - `PENDING_DOCUMENTS` (and the legacy nested statuses) is "Confirmed", never "Approved".
 * - "Cancelled", never "Declined", unless the host actually declined.
 */

/** Guest word for a booking status. Never says "Approved" or "Confirmed" for a pending review. */
export type GuestJourneyStatusWord =
  | 'Request sent'
  | 'Confirmed'
  | 'Ready for check-in'
  | 'Checked out'
  | 'Deposit refund'
  | 'Completed'
  | 'Cancelled';

export type GuestJourneyTone = 'neutral' | 'info' | 'success' | 'warning' | 'muted';

const CONFIRMED_STATUSES = new Set([
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
]);

/** Status → guest word. Unknown statuses fall back to "Request sent" (never "Booked"). */
export function guestJourneyStatusWord(status: string): GuestJourneyStatusWord {
  const s = String(status ?? '').trim();
  if (s === 'CANCELLED') return 'Cancelled';
  if (s === 'PENDING_REVIEW') return 'Request sent';
  if (CONFIRMED_STATUSES.has(s)) return 'Confirmed';
  if (s === 'READY_FOR_CHECKIN') return 'Ready for check-in';
  if (s === 'READY_FOR_CHECKOUT') return 'Checked out';
  if (s === 'PENDING_SD_REFUND') return 'Deposit refund';
  if (s === 'COMPLETED') return 'Completed';
  return 'Request sent';
}

/** Pill / badge tone for a booking status. */
export function guestJourneyStatusTone(status: string): GuestJourneyTone {
  const s = String(status ?? '').trim();
  if (s === 'CANCELLED') return 'muted';
  if (s === 'READY_FOR_CHECKIN') return 'success';
  if (s === 'READY_FOR_CHECKOUT') return 'warning';
  if (s === 'COMPLETED') return 'neutral';
  return 'info';
}

/**
 * The one thing the guest should do next, in plain words.
 *
 * `label` is the action, `detail` carries the concrete date / time / amount when there is
 * one. Callers render `detail` as a second line, never as a sentence fragment.
 */
export type GuestJourneyNextStep = {
  label: string;
  detail: string | null;
};

export type GuestJourneyNextStepInput = {
  status: string;
  /** Pre-formatted, e.g. "Sat, Oct 10". */
  checkInDateLabel?: string | null;
  /** Pre-formatted, e.g. "2:00 PM". */
  checkInTimeLabel?: string | null;
  /** Pre-formatted, e.g. "Sun, Oct 12". */
  checkOutDateLabel?: string | null;
  /** Pre-formatted, e.g. "11:00 AM". */
  checkOutTimeLabel?: string | null;
  /** Pre-formatted unpaid balance, e.g. "₱3,200". */
  amountDueLabel?: string | null;
  /** True while the guest still owes a balance. */
  hasBalanceDue?: boolean;
  /** True while the host is still preparing check-in documents. */
  documentsPending?: boolean;
};

/** The single next action for a booking status. */
export function guestJourneyNextStep(input: GuestJourneyNextStepInput): GuestJourneyNextStep {
  const s = String(input.status ?? '').trim();
  const checkIn = input.checkInDateLabel?.trim() ?? '';
  const checkInTime = input.checkInTimeLabel?.trim() ?? '';
  const checkOut = input.checkOutDateLabel?.trim() ?? '';
  const checkOutTime = input.checkOutTimeLabel?.trim() ?? '';

  if (s === 'CANCELLED') {
    return { label: 'Check the refund status', detail: null };
  }
  if (s === 'PENDING_REVIEW') {
    return { label: 'Wait for your host to review the request', detail: null };
  }
  if (CONFIRMED_STATUSES.has(s)) {
    if (input.documentsPending) {
      return { label: 'Send the documents your host asked for', detail: null };
    }
    return { label: 'Your host is preparing your check-in details', detail: null };
  }
  if (s === 'READY_FOR_CHECKIN') {
    if (input.hasBalanceDue && input.amountDueLabel) {
      return { label: `Pay ${input.amountDueLabel}`, detail: null };
    }
    const when = checkIn && checkInTime ? `${checkIn}, from ${checkInTime}` : checkIn;
    return { label: 'Check in', detail: when || null };
  }
  if (s === 'READY_FOR_CHECKOUT') {
    const when = checkOut && checkOutTime ? `${checkOut}, by ${checkOutTime}` : checkOut;
    return { label: 'Check out', detail: when || null };
  }
  if (s === 'PENDING_SD_REFUND') {
    return { label: 'Send your refund details', detail: null };
  }
  return { label: 'Your stay is complete', detail: null };
}

/**
 * How long a host usually takes to answer, from the property's own history.
 *
 * Needs at least `MIN_RESPONSE_SAMPLES` answered requests before it claims a number; below
 * that it falls back to the generic line. `medianHours` is the median time between a
 * request and the host's first reply.
 */
export const MIN_RESPONSE_SAMPLES = 5;

export function guestJourneyReviewExpectation(medianHours: number | null | undefined): string {
  if (medianHours == null || !Number.isFinite(Number(medianHours))) {
    return 'Most hosts reply within a day';
  }
  const hours = Number(medianHours);
  if (hours <= 0) return 'Most hosts reply within a few hours';
  if (hours < 24) {
    const rounded = Math.max(1, Math.round(hours));
    return `Hosts usually reply within ${rounded} hour${rounded === 1 ? '' : 's'}`;
  }
  const days = Math.max(1, Math.round(hours / 24));
  return `Hosts usually reply within ${days} day${days === 1 ? '' : 's'}`;
}

/** The guest word + next step together, as used by emails and the host "guest view" card. */
export function guestJourneySummary(input: GuestJourneyNextStepInput): {
  statusWord: GuestJourneyStatusWord;
  tone: GuestJourneyTone;
  nextStep: GuestJourneyNextStep;
} {
  return {
    statusWord: guestJourneyStatusWord(input.status),
    tone: guestJourneyStatusTone(input.status),
    nextStep: guestJourneyNextStep(input),
  };
}
