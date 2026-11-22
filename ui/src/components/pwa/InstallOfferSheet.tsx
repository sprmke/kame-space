import { useEffect, useState } from 'react';

import { X } from 'lucide-react';
import { toast } from 'sonner';

import { FixedBottomNoticeBar } from '@/components/pwa/FixedBottomNoticeBar';
import { InstallGuideSheet } from '@/components/pwa/InstallGuideSheet';
import type { InstallOfferState } from '@/components/pwa/useInstallOffer';
import { Button } from '@/components/ui/button';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { promptInstall } from '@/lib/pwa/installPrompt';
import { installGuideFor, type PlatformInfo } from '@/lib/pwa/platform';
import { usePwaSurfaceStore } from '@/lib/pwa/pwaSurfaceStore';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';
import { cn } from '@/lib/utils';

type InstallOfferSheetProps = {
  offer: InstallOfferState;
  platform: PlatformInfo;
};

/**
 * Proactive install offer. Fixed flush bottom bar (same chrome as cookie consent /
 * update prompt), one line of copy. Stacks above the cookie banner when both show
 * (`.pwa-bottom-notice-overlay` + `--cookie-consent-h`). Inline placement stays
 * page-owned.
 */
export function InstallOfferSheet({ offer, platform }: InstallOfferSheetProps) {
  const { decision, visible, dismiss, complete } = offer;
  const claim = usePwaSurfaceStore((s) => s.claim);
  const release = usePwaSurfaceStore((s) => s.release);
  const [guideOpen, setGuideOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  const variant = decision.show ? decision.variant : null;
  const placement = decision.show ? decision.placement : null;

  useEffect(() => {
    if (!visible || !variant || !placement) return;
    claim('install');
    pwaTelemetry('install-prompt-shown', { variant, placement });
    return () => release('install');
  }, [visible, variant, placement, claim, release]);

  // `inline` placement is rendered by the page that owns it, never as a bottom bar.
  if (!visible || !decision.show || decision.placement === 'inline') {
    return null;
  }

  const guide = installGuideFor(platform);
  const nativeVariant = decision.variant === 'native';

  const onInstall = async () => {
    if (installing) return;
    if (!nativeVariant) {
      setGuideOpen(true);
      return;
    }
    setInstalling(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        complete();
        toast.success('Installed. Open it from your home screen.');
      } else if (outcome === 'unavailable') {
        if (guide) setGuideOpen(true);
        else dismiss();
      } else {
        dismiss();
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      <FixedBottomNoticeBar
        overlayClassName="pwa-bottom-notice-overlay"
        heightCssVar="--pwa-bottom-notice-h"
        role="status"
        aria-label={`Install ${PLATFORM_APP_NAME}`}
      >
        <p className="text-foreground text-center text-[13px] font-medium leading-snug sm:text-sm">
          {`Install ${PLATFORM_APP_NAME}`}
        </p>
        <div className="flex shrink-0 items-center justify-center gap-1.5">
          <Button
            type="button"
            size="sm"
            className={cn(
              'h-10 min-h-10 rounded-full px-4 text-[13px] font-medium',
              'lg:h-9 lg:min-h-9'
            )}
            onClick={() => void onInstall()}
            disabled={installing}
          >
            Install
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="admin-overflow-trigger shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </FixedBottomNoticeBar>
      {guideOpen && guide ? (
        <InstallGuideSheet
          open={guideOpen}
          onOpenChange={(open) => {
            setGuideOpen(open);
            if (!open) complete();
          }}
          platform={platform}
          guide={guide}
        />
      ) : null}
    </>
  );
}
