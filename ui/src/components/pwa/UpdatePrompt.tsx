import { FixedBottomNoticeBar } from '@/components/pwa/FixedBottomNoticeBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type UpdatePromptProps = {
  onReload: () => void;
  onLater: () => void;
};

/**
 * A new build is waiting. Fixed flush bottom bar (same chrome as install / cookie),
 * one line. Non-blocking: the operator finishes what they are doing. "Later" snoozes
 * for four hours (not the whole session — installed apps are rarely closed, so a
 * session-long hide meant the update never landed, P1-3).
 */
export function UpdatePrompt({ onReload, onLater }: UpdatePromptProps) {
  return (
    <FixedBottomNoticeBar
      overlayClassName="pwa-bottom-notice-overlay"
      heightCssVar="--pwa-bottom-notice-h"
      role="status"
      aria-live="polite"
      aria-label="New version available"
    >
      <p className="text-foreground text-center text-[13px] font-medium leading-snug sm:text-sm">
        New version available
      </p>
      <div className="flex shrink-0 items-center justify-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            'h-10 min-h-10 rounded-full px-3 text-[13px] font-medium',
            'lg:h-9 lg:min-h-9 lg:px-3.5'
          )}
          onClick={onLater}
        >
          Later
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn(
            'h-10 min-h-10 rounded-full px-4 text-[13px] font-medium',
            'lg:h-9 lg:min-h-9'
          )}
          onClick={onReload}
        >
          Refresh
        </Button>
      </div>
    </FixedBottomNoticeBar>
  );
}
