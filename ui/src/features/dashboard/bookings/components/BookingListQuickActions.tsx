import type { MouseEvent } from 'react';

import { Link, useParams } from 'react-router-dom';

import { MessageSquare } from 'lucide-react';

import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { cn } from '@/lib/utils';

type Props = {
  row: BookingRow;
  /** Compact icon strip for table/card footers. */
  className?: string;
  /** Stop the parent row/card click from firing. */
  stopPropagation?: boolean;
};

/**
 * Row-level shortcuts for bookings list views (table / cards).
 * Chat opens the property Inbox when the host can view it.
 */
export function BookingListQuickActions({ row, className, stopPropagation = true }: Props) {
  const params = useParams<{ orgSlug?: string; propertySlug?: string }>();
  const org = useOptionalOrgContext();
  const { data: access } = usePropertyPermissions();
  const canInbox = hasPropertyPermission(access?.permissions, 'inbox:view');

  const orgSlug = org?.orgSlug ?? params.orgSlug;
  const propertySlug = org?.propertySlug ?? row.property_slug ?? params.propertySlug;

  if (!canInbox || !orgSlug || !propertySlug) return null;

  const inboxHref = propertySectionPath(orgSlug, propertySlug, 'inbox');

  const onActionClick = (e: MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
  };

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      onClick={onActionClick}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Link
        to={inboxHref}
        aria-label={`Open inbox for ${row.primary_guest_name || row.guest_email || 'guest'}`}
        title="Chat"
        className={cn(
          'text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-lg transition-colors',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2'
        )}
        onClick={onActionClick}
      >
        <MessageSquare className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
