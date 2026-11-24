import { CloudOff } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Props = {
  onRetry: () => void;
};

/**
 * Data-region error for the host / org Reviews pages; page chrome stays mounted.
 * Matches the empty state's surface and icon well so a failure reads as a state, not a
 * stray line of text.
 */
export function ReviewsLoadError({ onRetry }: Props) {
  return (
    <div
      role="alert"
      className="surface-card flex flex-col items-center justify-center gap-3 px-4 py-10 text-center sm:py-16"
    >
      <div className="icon-well-sm inline-flex items-center justify-center">
        <CloudOff className="text-muted-foreground size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-sm font-semibold">Reviews did not load</p>
        <p className="text-caption max-w-xs">Nothing was lost. Try again in a moment.</p>
      </div>
      <Button type="button" variant="outline" className="min-h-[44px]" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
