import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { captureAppEvent } from '@/lib/posthog/capture';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { channelLabel } from '@/features/dashboard/marketing/lib/planner/planItemStatus';
import {
  readBrowserShareCapabilities,
  resolveSharePlan,
} from '@/features/dashboard/marketing/lib/planner/plannerShare';
import type { PlannerItemDto } from '@/features/dashboard/marketing/lib/planner/plannerApi';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PlannerItemDto | null;
  onPosted: (item: PlannerItemDto, postedUrl?: string) => void;
  isPosting?: boolean;
};

/** Caption plus tracked link, in the order a host would paste it. */
export function buildShareText(item: PlannerItemDto, origin: string): string {
  const parts = [item.brief.hook, item.brief.message, item.brief.cta].filter(
    (part): part is string => Boolean(part && part.trim())
  );
  if (item.trackedUrl) {
    try {
      parts.push(new URL(item.trackedUrl, origin).toString());
    } catch {
      // A malformed stored path is not worth a broken paste.
    }
  }
  return parts.join('\n\n');
}

export function ShareItYourselfSheet({ open, onOpenChange, item, onPosted, isPosting }: Props) {
  const capabilities = useMemo(readBrowserShareCapabilities, []);
  const plan = resolveSharePlan(capabilities);
  const [done, setDone] = useState<string[]>([]);
  const [postedUrl, setPostedUrl] = useState('');

  if (!item) return null;

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const caption = buildShareText(item, origin);
  const targets = item.manualTargets.length > 0 ? item.manualTargets : [channelLabel(item.channelKind)];

  const toggle = (target: string) => {
    setDone((current) =>
      current.includes(target) ? current.filter((entry) => entry !== target) : [...current, target]
    );
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success('Caption copied');
    } catch {
      toast.error('Could not copy. Select the caption and copy it.');
    }
  };

  const share = async () => {
    captureAppEvent('planner_share_used', { mode: plan, channel: item.channelKind });
    if (plan === 'copy-only') {
      await copyCaption();
      return;
    }
    try {
      await navigator.share({ title: item.title, text: caption });
    } catch {
      // A cancelled share sheet is not an error.
    }
  };

  const finish = () => {
    onPosted(item, postedUrl.trim() || undefined);
    setPostedUrl('');
    setDone([]);
    onOpenChange(false);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{item.title}</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-caption text-muted-foreground">Caption</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
              {caption}
            </pre>
            <Button size="sm" variant="outline" onClick={() => void copyCaption()}>
              Copy caption
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-caption text-muted-foreground">Where you post</p>
            {targets.map((target) => (
              <label key={target} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={done.includes(target)}
                  onCheckedChange={() => toggle(target)}
                  aria-label={target}
                />
                {target}
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <label htmlFor="planner-posted-url" className="text-caption text-muted-foreground">
              Post link (optional)
            </label>
            <Input
              id="planner-posted-url"
              value={postedUrl}
              onChange={(event) => setPostedUrl(event.target.value)}
              placeholder="https://"
              inputMode="url"
            />
          </div>
        </div>

        <ResponsiveModalFooter className="flex flex-wrap gap-2">
          {plan === 'copy-only' ? null : (
            <Button size="sm" variant="outline" onClick={() => void share()}>
              Share
            </Button>
          )}
          <Button size="sm" onClick={finish} disabled={isPosting}>
            I posted it
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
