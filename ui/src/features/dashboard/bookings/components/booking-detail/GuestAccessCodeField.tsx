import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import { callUpdateBookingDetails } from '@/features/dashboard/bookings/lib/updateBookingDetailsApi';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

/** Reads the current override from the booking row, tolerating any stored shape. */
function readDoorCodeOverride(booking: BookingRow): string {
  const raw = (booking as unknown as { guest_essentials_override?: unknown })
    .guest_essentials_override;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
  const value = (raw as Record<string, unknown>).doorCode;
  return typeof value === 'string' ? value : '';
}

/**
 * Rotating lock code for this one stay (guest journey plan D7 / task 7.3).
 *
 * The property-level code covers most hosts. When a building changes the lock per guest, this
 * overrides it for this booking only. Empty clears the override and the property default
 * applies again. Reveal timing is unchanged: the guest still sees it from the reveal moment.
 */
export function GuestAccessCodeField({ booking }: { booking: BookingRow }) {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(() => readDoorCodeOverride(booking));
  const saved = readDoorCodeOverride(booking);
  const isDirty = value.trim() !== saved.trim();

  const save = useMutation({
    mutationFn: async (doorCode: string) =>
      callUpdateBookingDetails(propertyId, {
        bookingId: booking.id,
        operation: 'save_guest_access_code',
        doorCode,
      }),
    onSuccess: () => {
      toast.success('Door code saved');
      void queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not save the door code');
    },
  });

  useUnsavedChangesGuard({
    isDirty,
    onSave: async () => {
      try {
        await save.mutateAsync(value.trim());
        return true;
      } catch {
        return false;
      }
    },
  });

  return (
    <div className="space-y-1.5">
      <Label htmlFor="guest-access-code" className="settings-field-label">
        Door code for this stay
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id="guest-access-code"
          value={value}
          placeholder={saved ? saved : 'Uses the property code'}
          maxLength={60}
          autoComplete="off"
          onChange={(event) => setValue(event.target.value)}
          className="max-w-[16rem]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isDirty || save.isPending}
          onClick={() => save.mutate(value.trim())}
        >
          <KeyRound className="size-4" aria-hidden />
          Save
        </Button>
      </div>
    </div>
  );
}
