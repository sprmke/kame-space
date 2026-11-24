import { useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import {
  requestGuestTripHelp,
  type GuestTripHelpKind,
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const HELP_KINDS: Array<{ value: GuestTripHelpKind; label: string; hint: string }> = [
  { value: 'cant_get_in', label: "I can't get in", hint: 'Wrong code, no key, locked out' },
  { value: 'not_as_described', label: 'Not as described', hint: 'Wrong unit, missing amenity' },
  { value: 'unsafe', label: 'Unsafe or emergency', hint: 'No power, no water, danger' },
  { value: 'other', label: 'Something else', hint: 'Tell us what happened' },
];

/**
 * Booking-linked urgent help. Visible from check-in eve through check-out; the server enforces
 * the window. The host is notified and the ops channel is paged, so this is not a chat message
 * that can go unread.
 */
export function GuestTripHelpButton({ bookingId }: { bookingId: string }) {
  const { status, requireGuestAuth } = useGuestAuth();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<GuestTripHelpKind>('cant_get_in');
  const [note, setNote] = useState('');
  const [sentAt, setSentAt] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => requestGuestTripHelp({ bookingId, kind, note: note.trim() || undefined }),
    onSuccess: ({ alreadyOpen }) => {
      setSentAt(new Date().toISOString());
      setOpen(false);
      setNote('');
      toast.success(alreadyOpen ? 'Your request is already with the host' : 'Help request sent');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not send the request'),
  });

  const start = () => {
    // The request is account-scoped. A token-only guest can still see the action; signing in
    // happens here, at the moment they need it, instead of hiding the feature.
    if (status === 'authenticated') {
      setOpen(true);
      return;
    }
    requireGuestAuth(() => setOpen(true));
  };

  return (
    <>
      <Button type="button" variant="outline" className="min-h-[44px] w-full gap-2" onClick={start}>
        <LifeBuoy className="size-4" aria-hidden />
        {sentAt ? 'Help requested' : 'Get help now'}
      </Button>
      {sentAt ? (
        <p className="text-muted-foreground text-xs" role="status">
          Help requested at{' '}
          {new Intl.DateTimeFormat('en-PH', {
            timeZone: 'Asia/Manila',
            timeStyle: 'short',
          }).format(new Date(sentAt))}
          . The host has been notified.
        </p>
      ) : null}

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Get help now</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              This alerts the host and our support team. Use it for arrival problems, not general
              questions.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="space-y-3 px-4 py-2 sm:px-5">
            <div className="grid gap-2" role="group" aria-label="What went wrong?">
              {HELP_KINDS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={kind === item.value}
                  onClick={() => setKind(item.value)}
                  className={cn(
                    'min-h-[56px] rounded-xl border px-3 py-2 text-left',
                    kind === item.value ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="text-muted-foreground block text-xs">{item.hint}</span>
                </button>
              ))}
            </div>
            {kind === 'unsafe' ? (
              <p className="text-destructive text-xs">If anyone is in danger, call 911 first.</p>
            ) : null}
            <div className="space-y-1.5">
              <label htmlFor="help-note" className="text-sm font-medium">
                What happened?
              </label>
              <Textarea
                id="help-note"
                value={note}
                rows={3}
                maxLength={1000}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:flex-1"
              onClick={() => setOpen(false)}
              disabled={send.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] w-full sm:flex-1"
              disabled={send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? 'Sending' : 'Send request'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
