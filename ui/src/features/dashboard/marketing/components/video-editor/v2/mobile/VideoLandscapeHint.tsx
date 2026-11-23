import { useState } from 'react';

import { Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIsLandscapePhone } from '@/hooks/useMediaQuery';

/**
 * Held sideways, the phone editor has no room: the preview shrinks to a sliver. Say so plainly
 * instead of showing a broken screen. "Keep editing" dismisses it for the rest of the session.
 */
export function VideoLandscapeHint() {
  const sideways = useIsLandscapePhone();
  const [dismissed, setDismissed] = useState(false);
  if (!sideways || dismissed) return null;
  return (
    <div
      role="dialog"
      aria-label="Turn your phone upright"
      className="bg-background/95 absolute inset-0 z-[60] flex items-center justify-center gap-5 px-8 backdrop-blur"
    >
      <Smartphone className="text-primary size-12 shrink-0" aria-hidden />
      <div className="space-y-2">
        <p className="text-base font-semibold">Turn your phone upright</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          The editor has more room that way, so you can see your video while you work.
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => setDismissed(true)}
        >
          Keep editing
        </Button>
      </div>
    </div>
  );
}
