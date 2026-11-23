import { Download, Send } from 'lucide-react';

import { MARKETING_PUBLISH_META_LABEL } from '@/features/dashboard/marketing/lib/marketingStudioCopy';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exporting: boolean;
  canDownload: boolean;
  canPublish: boolean;
  onDownload: () => void;
  onPublish: () => void;
};

/** One place to finish a video on a phone: save it to the device or publish it. */
export function VideoExportSheet({
  open,
  onOpenChange,
  exporting,
  canDownload,
  canPublish,
  onDownload,
  onPublish,
}: Props) {
  return (
    <MobileChoiceSheet open={open} onOpenChange={onOpenChange} title="Export">
      {canDownload ? (
        <MobileChoiceItem
          label={exporting ? 'Exporting…' : 'Download MP4'}
          description="Save the video to your phone"
          icon={<Download className="size-5" aria-hidden />}
          trailing={<TierBadge feature="marketingStudio" />}
          disabled={exporting}
          onSelect={() => {
            onOpenChange(false);
            onDownload();
          }}
        />
      ) : null}
      {canPublish ? (
        <MobileChoiceItem
          label={MARKETING_PUBLISH_META_LABEL}
          description="Post it to your page"
          icon={<Send className="size-5" aria-hidden />}
          trailing={<TierBadge feature="marketingPublishLimitPerGroup" />}
          disabled={exporting}
          onSelect={() => {
            onOpenChange(false);
            onPublish();
          }}
        />
      ) : null}
    </MobileChoiceSheet>
  );
}
