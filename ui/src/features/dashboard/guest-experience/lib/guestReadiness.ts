/**
 * Arrival readiness for Guest experience (guest journey plan 7.2).
 *
 * Only rows this section owns or deep-links cleanly: essentials (Manage modal) and
 * check-in / check-out steps (Templates). Payment, house rules, and cancellation stay
 * on their own settings cards so this list does not double as a second settings hub.
 */

export type GuestReadinessStatus = 'ready' | 'default' | 'missing';

export type GuestReadinessRow = {
  id: 'check-in' | 'check-out' | 'essentials';
  label: string;
  status: GuestReadinessStatus;
  hint: string | null;
};

export type GuestReadinessInput = {
  checkInCustomised: boolean;
  checkOutCustomised: boolean;
  hasEssentials: boolean;
};

export function guestReadinessRows(input: GuestReadinessInput): GuestReadinessRow[] {
  return [
    {
      id: 'check-in',
      label: 'Check-in steps',
      status: input.checkInCustomised ? 'ready' : 'default',
      hint: input.checkInCustomised ? null : 'Default steps. Edit in Templates.',
    },
    {
      id: 'check-out',
      label: 'Check-out steps',
      status: input.checkOutCustomised ? 'ready' : 'default',
      hint: input.checkOutCustomised ? null : 'Default steps. Edit in Templates.',
    },
    {
      id: 'essentials',
      label: 'Essentials',
      status: input.hasEssentials ? 'ready' : 'missing',
      hint: input.hasEssentials ? null : 'Add Wi-Fi, the door code, or a contact.',
    },
  ];
}

/** Rows a host still has to act on (true gaps only). Defaults are not gaps. */
export function guestReadinessGaps(rows: GuestReadinessRow[]): GuestReadinessRow[] {
  return rows.filter((row) => row.status === 'missing');
}
