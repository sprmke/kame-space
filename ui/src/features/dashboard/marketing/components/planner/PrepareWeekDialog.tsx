import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { RANGE_LABELS, resolveRangeWindow } from '@/features/dashboard/marketing/lib/planner/plannerRange';
import type { PlannerRange } from '@/features/dashboard/marketing/lib/planner/plannerRange';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range: PlannerRange;
  today: string;
  itemCount: number;
  isPreparing?: boolean;
  onConfirm: (window: { from: string; to: string }) => Promise<boolean> | boolean;
};

/**
 * Prepare my week: moves every unbuilt item in the range to "preparing" and opens the work
 * list. The host still finishes each draft; the editors are canvases, not a batch renderer.
 */
export function PrepareWeekDialog({
  open,
  onOpenChange,
  range,
  today,
  itemCount,
  isPreparing,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false);
  const window = resolveRangeWindow(range, today);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Prepare {RANGE_LABELS[range].toLowerCase()}</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="space-y-2 text-sm">
          <p>
            {itemCount > 0
              ? `${itemCount} ${itemCount === 1 ? 'item needs' : 'items need'} a design, video or calendar. They move to Preparing so you can pick up where you left off.`
              : 'Nothing to prepare here yet. Build a plan first.'}
          </p>
          <p className="text-caption text-muted-foreground">
            Each item opens with your dates and copy already in it.
          </p>
        </div>
        <ResponsiveModalFooter className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={itemCount === 0 || busy || isPreparing}
            onClick={async () => {
              setBusy(true);
              const ok = await onConfirm(window);
              setBusy(false);
              if (ok) onOpenChange(false);
            }}
          >
            {busy || isPreparing ? 'Preparing' : 'Start'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
