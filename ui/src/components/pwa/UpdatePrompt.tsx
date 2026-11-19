import { FloatingBottomOverlay } from '@/components/pwa/FloatingBottomOverlay';
import { Button } from '@/components/ui/button';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';

type UpdatePromptProps = {
  onReload: () => void;
  onLater: () => void;
};

/**
 * A new build is waiting. Non-blocking: the operator finishes what they are doing.
 * "Later" snoozes for four hours (not the whole session — installed apps are
 * rarely closed, so a session-long hide meant the update never landed, P1-3).
 */
export function UpdatePrompt({ onReload, onLater }: UpdatePromptProps) {
  return (
    <FloatingBottomOverlay>
      <div
        role="status"
        className="border-border bg-background pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl border p-2.5 shadow-lg"
      >
        <p className="text-foreground min-w-0 flex-1 text-[13px] font-medium leading-snug">
          New version available
          <span className="text-muted-foreground block text-xs font-normal">
            {`A newer version of ${PLATFORM_APP_NAME} is ready.`}
          </span>
        </p>
        <Button size="sm" variant="ghost" onClick={onLater}>
          Later
        </Button>
        <Button size="sm" onClick={onReload}>
          Refresh
        </Button>
      </div>
    </FloatingBottomOverlay>
  );
}
