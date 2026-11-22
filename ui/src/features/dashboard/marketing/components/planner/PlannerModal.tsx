import { PlannerHome } from '@/features/dashboard/marketing/components/planner/PlannerHome';

import { MODAL_BODY_CLASS, MODAL_HEADER_CLASS } from '@/components/ui/modal-chrome';
import {
  ResponsiveModal,
  ResponsiveModalContent,
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
 *
 * Chrome matches `AdminDialogShell` / `ShareItYourselfSheet`: title in
 * `MODAL_HEADER_CLASS`, default absolute close on desktop. Bottom sheets hide
 * the X (drag handle + scrim). Do not put `ResponsiveModalClose` inside
 * `ResponsiveModalHeader` — that fights the close gutter and floats the X.
 */
export function PlannerModal({ open, onOpenChange }: Props) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="bg-background flex max-h-[min(92dvh,48rem)] w-full max-w-[min(calc(100vw-1.5rem),40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl sm:p-0"
        aria-describedby={undefined}
      >
        <ResponsiveModalHeader className={cn(MODAL_HEADER_CLASS, 'text-left')}>
          <ResponsiveModalTitle>Plan</ResponsiveModalTitle>
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
