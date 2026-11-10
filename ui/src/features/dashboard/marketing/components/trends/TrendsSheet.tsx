import { useEffect, useMemo, useState } from 'react';

import { ChevronRight } from 'lucide-react';

import { useMarketingTrends } from '@/features/dashboard/marketing/hooks/useMarketingTrends';
import type {
  TrendAngle,
  TrendCategory,
  TrendOutput,
  TrendTopic,
  TrendWindow,
} from '@/features/dashboard/marketing/lib/trends/trendTypes';
import {
  TREND_CATEGORIES,
  TREND_CATEGORY_LABELS,
  TREND_MOMENTUM_LABELS,
  TREND_WINDOW_LABELS,
  TREND_WINDOWS,
} from '@/features/dashboard/marketing/lib/trends/trendTypes';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

import { TREND_CATEGORY_ICONS } from './trendIcons';
import { TrendTopicDetail } from './TrendTopicDetail';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Window to show first. */
  initialWindow?: TrendWindow;
  /** Topic to open straight away (a chip tap). */
  initialTopicKey?: string | null;
  onUseAngle: (angle: TrendAngle, topic: TrendTopic) => void;
  /** Whether the plan or role does not cover this output. */
  isLocked: (output: TrendOutput) => boolean;
};

/** "Updated today 5:30 AM" or "Updated Nov 8". */
function updatedLabel(runDate: string | null, publishedAt: string | null): string {
  if (!runDate) return '';
  const published = publishedAt ? new Date(publishedAt) : null;
  if (published) {
    return `Updated ${published.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
    })}`;
  }
  return `Updated ${runDate}`;
}

/**
 * The Trends sheet: the full ranked list, the three windows and a category
 * filter. Opening a topic pushes a detail view inside the same sheet.
 */
export function TrendsSheet({
  open,
  onOpenChange,
  initialWindow,
  initialTopicKey,
  onUseAngle,
  isLocked,
}: Props) {
  const [window, setWindow] = useState<TrendWindow>(initialWindow ?? 'today');
  const [category, setCategory] = useState<TrendCategory | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(initialTopicKey ?? null);

  useEffect(() => {
    if (!open) return;
    if (initialWindow) setWindow(initialWindow);
    // "See all" opens with no topic, so the list is what the host gets. Opening a chip
    // passes a key and goes straight to that topic.
    setOpenKey(initialTopicKey ?? null);
  }, [open, initialWindow, initialTopicKey]);

  const query = useMarketingTrends(window, open);
  const payload = query.data;

  const windows = useMemo<TrendWindow[]>(() => {
    const available = payload?.windowsAvailable ?? [];
    const list = TREND_WINDOWS.filter((candidate) => available.includes(candidate));
    return list.length ? list : ['today'];
  }, [payload?.windowsAvailable]);

  const topics = payload?.topics ?? [];
  const filtered = category ? topics.filter((topic) => topic.category === category) : topics;
  const categories = useMemo(() => {
    const present = new Set(topics.map((topic) => topic.category));
    return TREND_CATEGORIES.filter((candidate) => present.has(candidate));
  }, [topics]);

  const selected = openKey ? topics.find((topic) => topic.topicKey === openKey) ?? null : null;

  /** Open one topic and record that the host looked at it. */
  const openTopic = (topic: TrendTopic) => {
    setOpenKey(topic.topicKey);
    captureAppEvent('trend_topic_opened', { topic_key: topic.topicKey, rank: topic.rank });
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        className="sm:max-w-lg"
        sheetBodyClassName="space-y-4"
        sheetLayout="split"
      >
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {selected ? selected.title : 'Trends in the Philippines'}
          </ResponsiveModalTitle>
          {!selected ? (
            <p className="text-caption">{updatedLabel(payload?.runDate ?? null, payload?.publishedAt ?? null)}</p>
          ) : null}
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selected ? (
            <TrendTopicDetail
              topic={selected}
              isLocked={isLocked}
              onBack={() => setOpenKey(null)}
              onUseAngle={(angle) => onUseAngle(angle, selected)}
            />
          ) : (
            <div className="space-y-3">
              {windows.length > 1 ? (
                <SegmentedControl
                  value={window}
                  onChange={(next) => setWindow(next as TrendWindow)}
                  size="dense"
                  fullWidth
                  aria-label="Trend window"
                  options={windows.map((candidate) => ({
                    value: candidate,
                    label: TREND_WINDOW_LABELS[candidate],
                  }))}
                />
              ) : null}

              {categories.length > 1 ? (
                <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => setCategory(null)}
                      className={cn(
                        'border-border focus-visible:ring-ring inline-flex min-h-9 items-center rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                        category === null
                          ? 'bg-primary-strong text-primary-foreground'
                          : 'bg-card text-foreground hover:bg-muted/60'
                      )}
                    >
                      All
                    </button>
                  </li>
                  {categories.map((candidate) => {
                    const Icon = TREND_CATEGORY_ICONS[candidate];
                    const active = category === candidate;
                    return (
                      <li key={candidate} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => setCategory(active ? null : candidate)}
                          className={cn(
                            'border-border focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                            active
                              ? 'bg-primary-strong text-primary-foreground'
                              : 'bg-card text-foreground hover:bg-muted/60'
                          )}
                        >
                          <Icon className="size-3.5 shrink-0" aria-hidden />
                          {TREND_CATEGORY_LABELS[candidate]}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {query.isLoading ? (
                <ul className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <li key={index} className="space-y-2 rounded-xl border p-3">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </li>
                  ))}
                </ul>
              ) : filtered.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  {category
                    ? `No ${TREND_CATEGORY_LABELS[category].toLowerCase()} topics today`
                    : 'No topics yet today'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {filtered.map((topic) => (
                    <li key={topic.id}>
                      <button
                        type="button"
                        onClick={() => openTopic(topic)}
                        className="border-border bg-card focus-visible:ring-ring w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      >
                        <span className="flex items-start gap-2">
                          <span className="text-caption w-5 shrink-0 pt-0.5 tabular-nums">
                            {topic.rank}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">{topic.title}</span>
                              <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                            </span>
                            <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                              {topic.summary}
                            </span>
                            <span className="text-caption mt-1 block">
                              {TREND_MOMENTUM_LABELS[topic.momentum]}
                              {topic.daysTrending > 1 ? ` · ${topic.daysTrending} days` : ''}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-caption pt-1">Mention the trend, do not use their photos or logos.</p>
            </div>
          )}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
