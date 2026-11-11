/**
 * How ready a property's guest-facing content is (guest journey plan 7.2).
 *
 * Only asserts what it can actually verify. A row is `ready` when the host saved their own
 * content, `default` when the shipped copy is doing the work, and `missing` when there is
 * nothing for the guest at all. Rows it cannot read (house rules, cancellation policy) are
 * `check` links, not claims.
 */

export type GuestReadinessStatus = 'ready' | 'default' | 'missing';

export type GuestReadinessRow = {
  id: 'check-in' | 'check-out' | 'essentials' | 'payment' | 'house-rules' | 'cancellation';
  label: string;
  status: GuestReadinessStatus | 'check';
  /** What the host should do, when something is missing. */
  hint: string | null;
};

export type GuestReadinessInput = {
  /** The host saved their own check-in instructions (vs the shipped default). */
  checkInCustomised: boolean;
  checkOutCustomised: boolean;
  /** At least one essentials field is filled in. */
  hasEssentials: boolean;
  paymentMethodCount: number;
};

export function guestReadinessRows(input: GuestReadinessInput): GuestReadinessRow[] {
  return [
    {
      id: 'check-in',
      label: 'Check-in steps',
      status: input.checkInCustomised ? 'ready' : 'default',
      hint: input.checkInCustomised
        ? null
        : 'Using the default steps. Edit them to match your building.',
    },
    {
      id: 'check-out',
      label: 'Check-out steps',
      status: input.checkOutCustomised ? 'ready' : 'default',
      hint: input.checkOutCustomised
        ? null
        : 'Using the default steps. Edit them to match your building.',
    },
    {
      id: 'essentials',
      label: 'Essentials',
      status: input.hasEssentials ? 'ready' : 'missing',
      hint: input.hasEssentials ? null : 'Add Wi-Fi, the door code and a contact.',
    },
    {
      id: 'payment',
      label: 'Payment methods',
      status: input.paymentMethodCount > 0 ? 'ready' : 'missing',
      hint: input.paymentMethodCount > 0 ? null : 'Add a way for guests to pay the balance.',
    },
    { id: 'house-rules', label: 'House rules', status: 'check', hint: null },
    { id: 'cancellation', label: 'Cancellation policy', status: 'check', hint: null },
  ];
}

/** Rows a host still has to act on, for the card headline. */
export function guestReadinessGaps(rows: GuestReadinessRow[]): GuestReadinessRow[] {
  return rows.filter((row) => row.status === 'missing');
}
