import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { captureAppEvent } from '@/lib/posthog/capture';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  MODAL_BODY_CLASS,
  MODAL_FOOTER_CLASS,
  MODAL_HEADER_CLASS,
} from '@/components/ui/modal-chrome';
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
import { cn } from '@/lib/utils';

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
  const targets =
    item.manualTargets.length > 0 ? item.manualTargets : [channelLabel(item.channelKind)];

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
      <ResponsiveModalContent
        sheetLayout="split"
        className="flex max-h-[min(92dvh,36rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md sm:p-0"
      >
        <ResponsiveModalHeader className={cn(MODAL_HEADER_CLASS, 'space-y-0 text-left')}>
          <ResponsiveModalTitle>{item.title}</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div
          className={cn(
            'min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]',
            MODAL_BODY_CLASS
          )}
        >
          <div className="space-y-2">
            <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Caption
            </p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 p-3 text-sm leading-relaxed">
              {caption}
            </pre>
            <Button size="sm" variant="outline" onClick={() => void copyCaption()}>
              Copy caption
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Where you post
            </p>
            {targets.map((target) => (
              <label key={target} className="flex min-h-11 items-center gap-2.5 text-sm">
                <Checkbox
                  checked={done.includes(target)}
                  onCheckedChange={() => toggle(target)}
                  aria-label={target}
                />
                {target}
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
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

        <ResponsiveModalFooter className={cn(MODAL_FOOTER_CLASS, 'flex flex-wrap gap-2')}>
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
