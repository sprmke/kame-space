import { useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import { handleAiMutationError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { RatingStars } from '@/features/reviews/components/RatingStars';
import { useRespondToGuestReview } from '@/features/reviews/hooks/usePropertyReviews';
import { useDraftReviewWithAi } from '@/features/reviews/hooks/useReviewAutomation';
import { REVIEW_RESPONSE_MAX_LEN } from '@/features/reviews/lib/reviewCatalog';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { formatStayDateRange } from '@/utils/format/dates';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  guestName: string;
  existingText: string | null;
  /** The review being answered, so the host can write without closing the sheet. */
  reviewText?: string | null;
  starRating?: number | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
};

export function ReviewResponseSheet({
  open,
  onOpenChange,
  bookingId,
  guestName,
  existingText,
  reviewText = null,
  starRating = null,
  checkInDate = null,
  checkOutDate = null,
}: Props) {
  const [text, setText] = useState(existingText ?? '');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const submit = useRespondToGuestReview();
  const draftAi = useDraftReviewWithAi(bookingId);
  const { canUse: canAutomate } = useFeatureGate('reviewAutomation');
  const { open: openUpgradeModal } = useUpgradeModal();
  const baseline = useMemo(() => existingText ?? '', [existingText]);
  const trimmed = text.trim();
  const isDirty = open && text !== baseline;
  const stayRange = formatStayDateRange(checkInDate, checkOutDate);

  useEffect(() => {
    if (open) setText(existingText ?? '');
  }, [open, existingText]);

  const handleSave = async (): Promise<boolean> => {
    if (trimmed.length > REVIEW_RESPONSE_MAX_LEN) {
      toast.error(`Response must be ${REVIEW_RESPONSE_MAX_LEN} characters or fewer`);
      return false;
    }
    if (!trimmed || !isDirty) return false;
    try {
      await submit.mutateAsync({ bookingId, responseText: trimmed });
      toast.success('Response saved');
      onOpenChange(false);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save response');
      return false;
    }
  };

  const removeResponse = async () => {
    setConfirmRemove(false);
    try {
      await submit.mutateAsync({ bookingId, responseText: null });
      setText('');
      toast.success('Response removed');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove response');
    }
  };

  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: handleSave,
    onDiscard: () => setText(baseline),
  });

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title={`Respond to ${guestName}`}
        footer={
          <>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={requestClose}>
              Cancel
            </Button>
            {existingText ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive min-h-[44px]"
                disabled={submit.isPending}
                onClick={() => setConfirmRemove(true)}
              >
                Remove
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={draftAi.isPending}
              onClick={() => {
                if (!canAutomate) {
                  openUpgradeModal('reviewAutomation');
                  return;
                }
                void draftAi
                  .mutateAsync('guest_response')
                  .then((draftText) => {
                    setText(draftText);
                    toast.success('Draft added');
                  })
                  .catch((err) => {
                    if (err instanceof Error) handleAiMutationError(err);
                    else toast.error('Could not draft response');
                  });
              }}
            >
              {draftAi.isPending ? 'Drafting…' : 'Draft with AI'}
            </Button>
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={submit.isPending || !trimmed || !isDirty}
              onClick={() => void handleSave()}
            >
              {submit.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {reviewText?.trim() ? (
            <div className="border-border/60 bg-muted/30 rounded-lg border px-3 py-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {starRating ? <RatingStars value={starRating} /> : null}
                {stayRange ? (
                  <span className="text-data-secondary text-xs">{stayRange}</span>
                ) : null}
              </div>
              <p className="text-foreground/80 line-clamp-4 text-[13px] leading-relaxed">
                {reviewText}
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="review-response-text">Public response</Label>
            <Textarea
              id="review-response-text"
              value={text}
              maxLength={REVIEW_RESPONSE_MAX_LEN}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
        </div>
      </AdminDialogShell>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove your response?</AlertDialogTitle>
            <AlertDialogDescription>
              The guest will no longer see it on your listing. You can write a new one later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep response</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void removeResponse()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
