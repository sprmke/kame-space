import { X } from 'lucide-react';

import { PlannerHome } from '@/features/dashboard/marketing/components/planner/PlannerHome';

import {
  MODAL_BODY_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_HEADER_CLASS,
} from '@/components/ui/modal-chrome';
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Full planner surface as a sheet/dialog so Marketing keeps four creative tabs.
 * Nested item / setup / share dialogs portal on top of this shell.
 */
export function PlannerModal({ open, onOpenChange }: Props) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        showCloseButton={false}
        className="bg-background flex max-h-[min(92dvh,48rem)] w-full max-w-[min(calc(100vw-1.5rem),40rem)] flex-col gap-0 overflow-hidden p-0 max-lg:h-[min(92dvh,48rem)] sm:max-w-2xl sm:p-0"
        aria-describedby="planner-modal-desc"
      >
        <ResponsiveModalHeader
          className={cn(
            MODAL_HEADER_CLASS,
            'bg-background flex flex-row items-start justify-between gap-3 space-y-0 text-left'
          )}
        >
          <div className="min-w-0 space-y-0.5">
            <ResponsiveModalTitle>What to post</ResponsiveModalTitle>
            <ResponsiveModalDescription id="planner-modal-desc" className="text-caption">
              Suggest · Make · Share
            </ResponsiveModalDescription>
          </div>
          <ResponsiveModalClose className={MODAL_CLOSE_BUTTON_CLASS} aria-label="Close">
            <X className="size-4" aria-hidden />
          </ResponsiveModalClose>
        </ResponsiveModalHeader>
        <div
          className={cn(
            'bg-background min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]',
            MODAL_BODY_CLASS
          )}
        >
          <PlannerHome />
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
