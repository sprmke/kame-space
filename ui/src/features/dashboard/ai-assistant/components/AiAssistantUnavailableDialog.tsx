import { assistantUnavailableCopy } from '@/features/dashboard/ai-assistant/lib/assistantAccess';
import type { AssistantUnavailableReason } from '@/features/dashboard/ai-assistant/lib/assistantAccess';

import { Button } from '@/components/ui/button';
import { MODAL_FOOTER_CLASS, MODAL_HEADER_CLASS } from '@/components/ui/modal-chrome';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  reason: AssistantUnavailableReason | null;
  onOpenChange: (open: boolean) => void;
};

/** Explains why Ask AI / open-assistant could not start (kill switch, property, permission). */
export function AiAssistantUnavailableDialog({ reason, onOpenChange }: Props) {
  const open = reason !== null;
  const copy = reason ? assistantUnavailableCopy(reason) : null;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="flex max-h-[min(90dvh,24rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(90vw,24rem)]"
      >
        <ResponsiveModalHeader className={MODAL_HEADER_CLASS}>
          <ResponsiveModalTitle>{copy?.title ?? 'AI assistant unavailable'}</ResponsiveModalTitle>
          <ResponsiveModalDescription>{copy?.description}</ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <ResponsiveModalFooter className={MODAL_FOOTER_CLASS}>
          <Button
            type="button"
            className="min-h-[44px] w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            OK
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
