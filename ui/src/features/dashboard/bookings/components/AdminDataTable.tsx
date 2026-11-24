import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { ArrowUpRight, Car, Dog, PartyPopper, X } from 'lucide-react';

import { GuestAvatar } from '@/features/dashboard/bookings/components/GuestAvatar';
import { ParkingBroadcastCountdown } from '@/features/dashboard/bookings/components/ParkingBroadcastCountdown';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import {
  bookingFlagIconChipClass,
  bookingRequestsSurpriseDecor,
} from '@/features/dashboard/bookings/lib/bookingFlags';
import { bookingListDisplayName } from '@/features/dashboard/bookings/lib/bookingListDisplay';

import { cn } from '@/lib/utils';

/** Shared admin list table shell (Bookings, Finance Stays, Finance Transactions, …). */
export function AdminDataTable({
  children,
  minWidth = 560,
  className,
  stickyHeader = false,
}: {
  children: React.ReactNode;
  minWidth?: number;
  className?: string;
  /** Keep column headers visible while tbody scrolls (use in flex + min-h-0 parents). */
  stickyHeader?: boolean;
}) {
  if (stickyHeader) {
    return (
      <div
        className={cn(
          'surface-card surface-card-clip flex min-h-0 flex-1 flex-col overflow-hidden',
          className
        )}
      >
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table
            className="admin-data-table bg-card w-full border-collapse"
            style={{ minWidth: `${minWidth}px` }}
          >
            {children}
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('surface-card surface-card-clip', className)}>
      <div className="overflow-x-auto">
        <table
          className="admin-data-table bg-card w-full border-collapse"
          style={{ minWidth: `${minWidth}px` }}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export function AdminTableHeadRow({
  children,
  sticky = false,
}: {
  children: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <thead>
      <tr
        className={cn(
          'border-separator bg-card border-b',
          '[&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl',
          sticky &&
            '[&_th]:bg-card [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
        )}
      >
        {children}
      </tr>
    </thead>
  );
}

export function AdminTableTh({
  children,
  className,
  sort,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Sort state belongs on the column header, not on the button inside it (axe `aria-allowed-attr`). */
  sort?: 'ascending' | 'descending' | 'none';
}) {
  // `text-left` first so callers can override (e.g. Actions `text-right`).
  return (
    <th scope="col" aria-sort={sort} className={cn('text-table-head py-3 text-left', className)}>
      {children}
    </th>
  );
}

/**
 * Narrow right-aligned actions column header.
 * Prefer a visible "Actions" / "Open" label over `sr-only` so the trailing
 * column is not an unexplained empty band.
 */
export function AdminTableActionsTh({
  children = 'Actions',
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <AdminTableTh
      className={cn('w-[1%] whitespace-nowrap pl-2 pr-3 text-right sm:pl-3 sm:pr-4', className)}
    >
      {children}
    </AdminTableTh>
  );
}

/** Data row hover/border; set `interactive: false` for action-only rows (e.g. Transactions). */
export function adminTableRowClass(index: number, options: { interactive?: boolean } = {}) {
  const interactive = options.interactive !== false;
  return cn(
    'bg-card hover:bg-muted/40 dark:hover:bg-sidebar-accent/30 group transition-colors duration-100',
    interactive && 'cursor-pointer outline-none',
    interactive && 'focus-visible:bg-sidebar-accent/40',
    interactive &&
      'focus-visible:ring-sidebar-primary/40 focus-visible:ring-2 focus-visible:ring-inset',
    index > 0 && 'border-separator border-t'
  );
}

export const adminTableCell = {
  status: 'pl-3 pr-2 py-2.5 align-middle sm:pl-5 sm:pr-3 sm:py-3.5',
  body: 'px-2 py-2.5 align-middle sm:px-4 sm:py-3.5',
  money: 'px-2 py-2.5 text-left align-middle sm:px-4 sm:py-3.5',
  // `w-[1%]` + nowrap keeps the actions column hug its controls so data
  // columns absorb remaining width (avoids a large empty trailing band).
  action:
    'w-[1%] whitespace-nowrap py-2 pr-2 pl-1 text-right align-middle sm:pr-4 sm:pl-2 sm:py-3.5',
} as const;

/** Trailing affordance on clickable rows (Bookings list, Finance stays). */
export function AdminTableRowAffordance() {
  return (
    <span aria-hidden className={adminTableRowAffordanceClass}>
      <ArrowUpRight className="size-4" />
    </span>
  );
}

const adminTableRowAffordanceClass = cn(
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg',
  'text-muted-foreground',
  'transition-colors duration-150'
);

/** Same affordance as a router link (e.g. open booking from Finance stays). */
export function AdminTableRowLink({
  to,
  ariaLabel,
  onClick,
}: {
  to: string;
  ariaLabel: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(adminTableRowAffordanceClass, 'hover:text-foreground')}
    >
      <ArrowUpRight className="size-4" aria-hidden />
    </Link>
  );
}

/**
 * Icon button in table action cells (edit / delete / open).
 * Always visible — hover-only icons hide per-row controls that differ by item.
 */
export const adminTableIconButtonClass = cn(
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg',
  'text-muted-foreground transition-colors duration-150',
  'hover:bg-muted hover:text-foreground'
);

/** Body copy for Bookings + Finance stays tables — scales up on larger screens. */
export const adminTableBodyText = {
  primary: 'text-xs font-semibold leading-snug text-foreground sm:text-[13px]',
  secondary: 'text-xs font-normal leading-snug text-muted-foreground sm:text-[13px]',
} as const;

/** Money / pricing columns in admin tables. */
export function adminTableMoneyClass(colorClass?: string) {
  return cn(
    'text-xs font-medium tabular-nums leading-snug sm:text-[14px]',
    colorClass ?? 'text-muted-foreground'
  );
}

/** Status column — same wrapper as Bookings table. */
export function AdminTableStatusBadge({
  status,
  parkingBroadcastExpiresAt,
}: {
  status: string;
  /** Renders a live countdown under the badge when status is PENDING_HOST_ACCEPTANCE. */
  parkingBroadcastExpiresAt?: string | null;
}) {
  return (
    <div className="inline-flex flex-col gap-1">
      <StatusBadge status={status} />
      {status === 'PENDING_HOST_ACCEPTANCE' && parkingBroadcastExpiresAt && (
        <ParkingBroadcastCountdown expiresAt={parkingBroadcastExpiresAt} />
      )}
    </div>
  );
}

type GuestCellProps = {
  primary_guest_name?: string | null;
  guest_facebook_name?: string | null;
  guest_email?: string | null;
  valid_id_url?: string | null;
  /** e.g. stay dates when the Stay column is hidden on small screens */
  mobileExtra?: ReactNode;
  /** Makes the name the row's real link, so keyboard and voice control have a target. */
  href?: string;
};

/** Guest column — avatar, name, email (Bookings + Finance stays). */
export function AdminTableGuestCell({
  primary_guest_name,
  guest_facebook_name,
  guest_email,
  valid_id_url,
  mobileExtra,
  href,
}: GuestCellProps) {
  const name = bookingListDisplayName({
    primary_guest_name,
    guest_facebook_name,
    guest_email,
  });

  return (
    <div className="flex min-w-[140px] items-center gap-2.5 sm:min-w-[160px] sm:gap-3">
      <GuestAvatar name={name} validIdUrl={valid_id_url} size="md" />
      <div className="min-w-0 space-y-1">
        {href ? (
          <Link
            to={href}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              'focus-ring block truncate rounded-sm font-bold leading-snug hover:underline',
              adminTableBodyText.primary
            )}
          >
            {name}
          </Link>
        ) : (
          <p className={cn('truncate font-bold leading-snug', adminTableBodyText.primary)}>{name}</p>
        )}
        {guest_email ? (
          <p
            title={guest_email}
            className={cn('truncate leading-snug', adminTableBodyText.secondary)}
          >
            {guest_email}
          </p>
        ) : null}
        {mobileExtra ? <div className="md:hidden">{mobileExtra}</div> : null}
      </div>
    </div>
  );
}

type FlagsCellProps = {
  need_parking?: boolean | null;
  has_pets?: boolean | null;
  guest_requests_surprise_decor?: unknown;
  has_invalid_receipt_ai?: boolean;
  /** Omit the empty placeholder (e.g. inline flags on mobile finance cards). */
  hideEmpty?: boolean;
};

/** Flags column — parking / pet / decor / invalid receipt chips (Bookings + Finance stays). */
export function AdminTableFlagsCell({
  need_parking,
  has_pets,
  guest_requests_surprise_decor,
  has_invalid_receipt_ai = false,
  hideEmpty = false,
}: FlagsCellProps) {
  const decor = bookingRequestsSurpriseDecor(guest_requests_surprise_decor);
  const hasAny = need_parking || has_pets || decor || has_invalid_receipt_ai;

  if (!hasAny && hideEmpty) return null;

  return (
    <div className="inline-flex items-center justify-start gap-1.5">
      {need_parking ? (
        <span
          role="img"
          title="Needs parking"
          aria-label="Needs parking"
          className={cn('size-7', bookingFlagIconChipClass.parking)}
        >
          <Car className="size-4" aria-hidden />
        </span>
      ) : null}
      {has_pets ? (
        <span
          role="img"
          title="Has pets"
          aria-label="Has pets"
          className={cn('size-7', bookingFlagIconChipClass.pet)}
        >
          <Dog className="size-4" aria-hidden />
        </span>
      ) : null}
      {decor ? (
        <span
          role="img"
          title="Surprise decor setup"
          aria-label="Surprise decor setup"
          className={cn('size-7', bookingFlagIconChipClass.decor)}
        >
          <PartyPopper className="size-4" aria-hidden />
        </span>
      ) : null}
      {has_invalid_receipt_ai ? (
        <span
          role="img"
          title="AI: Needs review"
          aria-label="AI: Needs review"
          className={cn('size-7', bookingFlagIconChipClass.invalidReceipt)}
        >
          <X className="size-3.5" strokeWidth={2.75} aria-hidden />
        </span>
      ) : null}
      {!hasAny ? (
        <span className={cn(adminTableBodyText.secondary, 'text-muted-foreground/40')}>-</span>
      ) : null}
    </div>
  );
}
