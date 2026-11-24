import { LifeBuoy } from 'lucide-react';

import {
  useBookingHelp,
  useResolveBookingHelp,
} from '@/features/dashboard/bookings/hooks/useBookingHelp';

import { Button } from '@/components/ui/button';

const KIND_LABEL: Record<string, string> = {
  cant_get_in: "Can't get in",
  not_as_described: 'Not as described',
  unsafe: 'Unsafe or emergency',
  other: 'Other issue',
};

/** A guest used Get help now and the case is still open. */
export function BookingHelpCard({ bookingId, canEdit }: { bookingId: string; canEdit: boolean }) {
  const { data: request } = useBookingHelp(bookingId);
  const resolve = useResolveBookingHelp();

  if (!request) return null;

  return (
    <div className="border-warning/40 bg-warning/10 rounded-xl border p-4" role="status">
      <div className="flex items-start gap-2">
        <LifeBuoy className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-foreground text-sm font-semibold">
            Guest needs help: {KIND_LABEL[request.kind] ?? 'Other issue'}
          </p>
          {request.note ? (
            <p className="text-foreground whitespace-pre-wrap text-sm">{request.note}</p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {new Intl.DateTimeFormat('en-PH', {
              timeZone: 'Asia/Manila',
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(request.created_at))}
          </p>
        </div>
      </div>
      {canEdit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 min-h-[44px]"
          loading={resolve.isPending}
          onClick={() => resolve.mutate({ bookingId, helpRequestId: request.id })}
        >
          Mark resolved
        </Button>
      ) : null}
    </div>
  );
}
