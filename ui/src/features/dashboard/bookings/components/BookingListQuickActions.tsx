import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';

import { useNavigate } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import { BookingChatPickerDialog } from '@/features/dashboard/bookings/components/BookingChatPickerDialog';
import {
  bookingChatGuestName,
  bookingChatOutcome,
  buildInboxConversationHref,
  buildInboxSearchHref,
  resolveBookingChatDestination,
} from '@/features/dashboard/bookings/lib/bookingChatLink';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { fetchBookingChats } from '@/features/dashboard/inbox/lib/inboxApi';
import type { BookingChatMatch } from '@/features/dashboard/inbox/types/inbox';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrgSlugParam, useResolvedOrgId } from '@/features/dashboard/org/lib/adminApiScope';
import { useParkingPermissions } from '@/features/dashboard/team/hooks/useParkingPermissions';
import { usePropertyPermissionsFor } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasParkingPermission } from '@/features/dashboard/team/lib/parkingPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { Button } from '@/components/ui/button';
import { EdgeResponseError } from '@/lib/api/edgeError';
import { cn } from '@/lib/utils';

type Props = {
  row: BookingRow;
  className?: string;
  /** Stop the parent row/card click from firing. */
  stopPropagation?: boolean;
};

/** Short enough that a quick second tap is instant, long enough that new chats show up. */
const CHATS_STALE_MS = 15_000;

function failureMessage(error: unknown): string {
  if (error instanceof EdgeResponseError) {
    if (error.status === 403) return 'You do not have access to Messages here';
    if (error.status === 404) return 'This booking is no longer available';
  }
  return 'Could not check chats. Try again';
}

/**
 * Chat shortcut on a bookings list row (table and cards, property, parking and org lists).
 *
 * One thread opens it directly in the property or parking Inbox. Several open a picker. None
 * explains itself and offers a search. Always stays inside Messages.
 */
export function BookingListQuickActions({ row, className, stopPropagation = true }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgSlug = useOrgSlugParam();
  const orgId = useResolvedOrgId();
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();

  const [busy, setBusy] = useState(false);
  const [pickerMatches, setPickerMatches] = useState<BookingChatMatch[] | null>(null);

  const destination = useMemo(
    () =>
      resolveBookingChatDestination(row, orgSlug, {
        propertyId: orgContext?.property.id,
        propertySlug: orgContext?.propertySlug,
        parkingId: parkingContext?.parking.id,
        parkingSlug: parkingContext?.parkingSlug,
      }),
    [row, orgSlug, orgContext, parkingContext]
  );

  const propertyAccess = usePropertyPermissionsFor(
    destination?.kind === 'property' ? destination.id : null
  );
  const parkingAccess = useParkingPermissions(
    destination?.kind === 'parking' ? destination.id : null
  );

  if (!destination) return null;

  const canViewInbox =
    destination.kind === 'property'
      ? hasPropertyPermission(propertyAccess.data?.permissions, 'inbox:view')
      : hasParkingPermission(parkingAccess.data?.permissions, 'inbox:view');
  if (!canViewInbox) return null;

  const guestName = bookingChatGuestName(row);
  const scope =
    destination.kind === 'property'
      ? { propertyId: destination.id }
      : { parkingId: destination.id };

  const stop = (e: { stopPropagation: () => void }) => {
    if (stopPropagation) e.stopPropagation();
  };

  const openMatch = (match: BookingChatMatch) => {
    setPickerMatches(null);
    navigate(buildInboxConversationHref(destination.inboxPath, match));
  };

  const openSearch = () => {
    setPickerMatches(null);
    navigate(buildInboxSearchHref(destination.inboxPath, guestName));
  };

  const onOpenChat = async (e: MouseEvent) => {
    stop(e);
    if (busy) return;
    setBusy(true);
    try {
      const matches = await queryClient.fetchQuery({
        queryKey: ['booking-chats', destination.kind, destination.id, row.id],
        queryFn: () => fetchBookingChats(orgSlug, orgId, row.id, scope),
        staleTime: CHATS_STALE_MS,
      });
      const outcome = bookingChatOutcome(matches);
      if (outcome.kind === 'open') {
        openMatch(outcome.match);
      } else if (outcome.kind === 'choose') {
        setPickerMatches(outcome.matches);
      } else {
        toast('No chat for this booking yet', {
          action: { label: 'Search Messages', onClick: openSearch },
        });
      }
    } catch (error) {
      toast.error(failureMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-0.5', className)} onClick={stop} onKeyDown={stop}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="admin-overflow-trigger"
        aria-label={`Open chat with ${guestName}`}
        title="Open chat"
        aria-busy={busy}
        disabled={busy}
        onClick={onOpenChat}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <MessageSquare className="size-4" aria-hidden />
        )}
      </Button>
      {pickerMatches ? (
        <BookingChatPickerDialog
          open
          onOpenChange={(open) => {
            if (!open) setPickerMatches(null);
          }}
          guestName={guestName}
          matches={pickerMatches}
          onSelect={openMatch}
          onSearch={openSearch}
        />
      ) : null}
    </div>
  );
}
