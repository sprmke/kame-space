import type { ReactNode } from 'react';

import { format } from 'date-fns';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { MODAL_BODY_CLASS, MODAL_HEADER_CLASS } from '@/components/ui/modal-chrome';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date | null;
  count: number;
  entityLabel: string;
  children: ReactNode;
};

/**
 * Day stay list for dashboard mini + phone month view (bottom sheet below lg).
 */
export function CalendarDaySheet({
  open,
  onOpenChange,
  day,
  count,
  entityLabel,
  children,
}: Props) {
  const title = day ? format(day, 'EEE, MMM d') : 'Day';
  const description =
    count === 0
      ? `No ${entityLabel}s`
      : `${count} ${entityLabel}${count === 1 ? '' : 's'}`;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="max-lg:h-[min(92dvh,36rem)] sm:max-w-md"
        aria-describedby={undefined}
      >
        <ResponsiveModalHeader className={MODAL_HEADER_CLASS}>
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription>{description}</ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className={cn(MODAL_BODY_CLASS, 'min-h-0 flex-1 space-y-2 overflow-y-auto')}>
          {children}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
