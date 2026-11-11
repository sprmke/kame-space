import { useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { FileUp, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  GUEST_TRIP_QUERY_KEY,
  uploadGuestTripPaymentReceipt,
} from '@/features/guest/trip/lib/guestTripApi';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { captureAppEvent } from '@/lib/posthog/capture';

/** Matches the server's upload limit for a balance receipt. */
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Send the balance payment receipt from the trip page.
 *
 * The guest picks a photo or PDF, sees what they picked, and sends it. The host sees it in
 * the booking they already use; the booking status never changes on its own (plan D12).
 */
export function GuestTripReceiptSheet({
  open,
  onOpenChange,
  bookingId,
  amountDueLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  /** Pre-formatted unpaid balance, shown as context. */
  amountDueLabel: string | null;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  function reset() {
    setFile(null);
    setSending(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function pick(next: File | null | undefined) {
    if (!next) return;
    if (!ACCEPTED.includes(next.type)) {
      toast.error('Use a photo or a PDF');
      return;
    }
    if (next.size > MAX_BYTES) {
      toast.error('That file is over 10 MB');
      return;
    }
    setFile(next);
  }

  async function send() {
    if (!file) return;
    setSending(true);
    try {
      await uploadGuestTripPaymentReceipt(bookingId, file);
      captureAppEvent('guest_receipt_uploaded', { source: 'trip_page' });
      toast.success('Receipt sent to your host');
      void queryClient.invalidateQueries({ queryKey: GUEST_TRIP_QUERY_KEY });
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We could not send your receipt');
      setSending(false);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Send your receipt</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {amountDueLabel
              ? `Attach the proof of payment for ${amountDueLabel}.`
              : 'Attach the proof of payment.'}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            className="sr-only"
            onChange={(event) => pick(event.target.files?.[0])}
          />
          {file ? (
            <div className="border-border flex items-center gap-3 rounded-xl border p-3">
              <FileUp className="text-muted-foreground size-5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{file.name}</span>
                <span className="text-muted-foreground block text-xs">
                  {Math.max(1, Math.round(file.size / 1024))} KB
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label="Remove file"
                onClick={reset}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="size-4" aria-hidden />
              Choose photo or PDF
            </Button>
          )}
        </div>

        <ResponsiveModalFooter>
          <Button type="button" variant="ghost" className="min-h-[44px]" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-[44px]"
            disabled={!file || sending}
            loading={sending}
            onClick={() => void send()}
          >
            Send receipt
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
