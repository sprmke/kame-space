import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatItemTime,
  formatDayHeading,
} from '@/features/dashboard/marketing/lib/planner/plannerRange';
import {
  channelLabel,
  formatLabel,
  isManualChannel,
  planItemStatusView,
} from '@/features/dashboard/marketing/lib/planner/planItemStatus';
import type { PlannerItemDto } from '@/features/dashboard/marketing/lib/planner/plannerApi';

const TONE_CLASS: Record<string, string> = {
  neutral: '',
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-destructive/30 bg-destructive/5 text-destructive',
};

type Props = {
  item: PlannerItemDto;
  day: string;
  today: string;
  onOpen: (item: PlannerItemDto) => void;
  /** Opens the editor for an item that already has a draft in progress. */
  onOpenEditor?: (item: PlannerItemDto) => void;
  onSkip: (item: PlannerItemDto) => void;
  onMarkPosted: (item: PlannerItemDto) => void;
  readOnly?: boolean;
};

export function PlanItemCard({
  item,
  day,
  today,
  onOpen,
  onOpenEditor,
  onSkip,
  onMarkPosted,
  readOnly,
}: Props) {
  const view = planItemStatusView(item.status);
  const time = formatItemTime(item.scheduledFor);
  const manual = isManualChannel(item.channelKind);
  const dayHeading = formatDayHeading(day, today);

  return (
    <Card className="border-border/70">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">
              {time ? `${time} · ` : ''}
              {dayHeading} · {formatLabel(item.format)} · {channelLabel(item.channelKind)}
            </p>
            <p className="text-card-title font-semibold">{item.title}</p>
          </div>
          <Badge variant="outline" className={TONE_CLASS[view.tone]}>
            {view.label}
          </Badge>
        </div>

        {item.brief.hook ? <p className="text-sm text-foreground">{item.brief.hook}</p> : null}
        {item.brief.why ? (
          <p className="text-caption text-muted-foreground">{item.brief.why}</p>
        ) : null}
        {item.statusReason ? (
          <p className="text-caption text-amber-700">{item.statusReason}</p>
        ) : null}
        {item.trackedVisits > 0 ? (
          <p className="text-caption text-muted-foreground">
            {item.trackedVisits} {item.trackedVisits === 1 ? 'page visit' : 'page visits'} from
            this link
          </p>
        ) : null}

        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {view.actionLabel ? (
              <Button
                size="sm"
                onClick={() =>
                  view.action === 'review' && onOpenEditor ? onOpenEditor(item) : onOpen(item)
                }
              >
                {view.actionLabel}
              </Button>
            ) : null}
            {manual && item.status !== 'posted_manually' ? (
              <Button size="sm" variant="outline" onClick={() => onMarkPosted(item)}>
                I posted it
              </Button>
            ) : null}
            {manual && item.manualTargets.length > 0 ? (
              <span className="text-caption text-muted-foreground">
                {item.manualTargets.join(', ')}
              </span>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => onSkip(item)}
            >
              Skip
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
