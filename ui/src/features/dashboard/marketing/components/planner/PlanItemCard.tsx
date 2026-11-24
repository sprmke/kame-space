import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarketingOverflowMenu } from '@/features/dashboard/marketing/components/shared/MarketingOverflowMenu';
import { formatItemTime } from '@/features/dashboard/marketing/lib/planner/plannerRange';
import { describeClaimLines } from '@/features/dashboard/marketing/lib/planner/plannerRange';
import {
  channelLabel,
  formatLabel,
  isManualChannel,
  planItemStatusView,
} from '@/features/dashboard/marketing/lib/planner/planItemStatus';
import type { PlannerItemDto } from '@/features/dashboard/marketing/lib/planner/plannerApi';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<string, string> = {
  neutral: '',
  positive: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning',
  danger: 'border-destructive/30 bg-destructive/5 text-destructive',
};

type Props = {
  item: PlannerItemDto;
  day: string;
  today: string;
  onOpen: (item: PlannerItemDto) => void;
  /** Opens the editor that finishes this item. */
  onOpenEditor?: (item: PlannerItemDto) => void;
  onSkip: (item: PlannerItemDto) => void;
  onMarkPosted: (item: PlannerItemDto) => void;
  readOnly?: boolean;
};

export function PlanItemCard({
  item,
  onOpen,
  onOpenEditor,
  onSkip,
  onMarkPosted,
  readOnly,
}: Props) {
  const view = planItemStatusView(item.status);
  const time = formatItemTime(item.scheduledFor);
  const manual = isManualChannel(item.channelKind);
  const claimLine = describeClaimLines(item.claims)[0] ?? null;
  const leadPhoto = item.brief.photoUrls?.[0] ?? null;
  const why = item.brief.why?.trim() || null;

  const overflowItems = [];
  if (!readOnly) {
    overflowItems.push({
      id: 'details',
      label: 'Edit details',
      onSelect: () => onOpen(item),
    });
    if (manual && item.status !== 'posted_manually') {
      overflowItems.push({
        id: 'posted',
        label: 'I posted it',
        onSelect: () => onMarkPosted(item),
      });
    }
    if (view.action !== 'none') {
      overflowItems.push({
        id: 'skip',
        label: 'Skip',
        onSelect: () => onSkip(item),
      });
    }
  }

  const runPrimary = () => {
    if (view.action === 'fix') {
      onOpen(item);
      return;
    }
    if (view.action === 'share') {
      onMarkPosted(item);
      return;
    }
    // Make this / Continue / Open → Studio when available; else details sheet.
    if (onOpenEditor && (view.action === 'create' || view.action === 'review')) {
      onOpenEditor(item);
      return;
    }
    onOpen(item);
  };

  return (
    <article className="border-border/70 bg-card space-y-2.5 rounded-xl border p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        {leadPhoto ? (
          <img
            src={leadPhoto}
            alt=""
            className="border-border/60 size-12 shrink-0 rounded-lg border object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-caption text-muted-foreground">
                {[time, formatLabel(item.format), channelLabel(item.channelKind)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h4 className="text-sm font-semibold leading-snug">{item.title}</h4>
            </div>
            <Badge variant="outline" className={cn('shrink-0', TONE_CLASS[view.tone])}>
              {view.label}
            </Badge>
          </div>
        </div>
      </div>

      {why ? <p className="text-sm leading-snug text-foreground/90">{why}</p> : null}
      {!why && item.brief.hook ? (
        <p className="text-sm leading-snug text-foreground/90">{item.brief.hook}</p>
      ) : null}
      {claimLine ? (
        <p className="text-caption text-muted-foreground">
          {claimLine}. We pause this if the dates book.
        </p>
      ) : null}
      {item.statusReason ? (
        <p className="text-caption text-warning-foreground dark:text-warning">{item.statusReason}</p>
      ) : null}
      {item.trackedVisits > 0 ? (
        <p className="text-caption text-muted-foreground">
          {item.trackedVisits} {item.trackedVisits === 1 ? 'visit' : 'visits'} from this link
        </p>
      ) : null}

      {!readOnly ? (
        <div className="flex items-center gap-2 pt-0.5">
          {view.actionLabel ? (
            <Button size="sm" onClick={runPrimary}>
              {view.actionLabel}
            </Button>
          ) : null}
          {manual && view.phase !== 'done' ? (
            <Button size="sm" variant="outline" onClick={() => onMarkPosted(item)}>
              Share
            </Button>
          ) : null}
          {manual && item.manualTargets.length > 0 ? (
            <span className="text-caption text-muted-foreground truncate">
              {item.manualTargets.join(', ')}
            </span>
          ) : null}
          {overflowItems.length > 0 ? (
            <div className="ml-auto shrink-0">
              <MarketingOverflowMenu
                label={`${item.title} options`}
                icon="horizontal"
                forceSheet
                menuItems={overflowItems}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
