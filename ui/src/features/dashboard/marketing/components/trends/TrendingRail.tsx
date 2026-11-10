import { ChevronRight } from 'lucide-react';

import { useMarketingTrends } from '@/features/dashboard/marketing/hooks/useMarketingTrends';
import { evergreenIdeasForMonth } from '@/features/dashboard/marketing/lib/trends/evergreenIdeas';
import type { TrendCategory } from '@/features/dashboard/marketing/lib/trends/trendTypes';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { TREND_CATEGORY_ICONS } from './trendIcons';

type Props = {
  /** Open the sheet on one topic. */
  onOpenTopic: (topicKey: string) => void;
  /** Open the sheet on the full list. */
  onSeeAll: () => void;
};

/** How many chips fit before the rail scrolls. */
const MAX_CHIPS = 8;

/** One chip. Trends and seasonal ideas both render through this. */
type Chip = { key: string; title: string; category: TrendCategory };

const CHIP_CLASS =
  'border-border bg-card text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 hover:bg-muted/60';

/**
 * "Trending today" rail at the top of the AI Studio create form.
 *
 * The mount is the gate: this component only exists inside the create form, so
 * opening Marketing on another tab never asks for the list. An earlier version also
 * waited for an IntersectionObserver hit, which added no benefit (the rail is above
 * the fold whenever the form is open) and one silent failure mode: if the observer
 * never fired, the list never loaded.
 *
 * When there is no usable list the rail shows the bundled seasonal ideas and says so.
 */
export function TrendingRail({ onOpenTopic, onSeeAll }: Props) {
  const query = useMarketingTrends('today');
  const payload = query.data;

  // The super admin turned Trends off for this property: the rail is not rendered
  // at all, rather than showing an error.
  if (payload?.disabled === true) return null;

  const fallback = payload?.fallback === 'evergreen';
  const chips: Chip[] = fallback
    ? evergreenIdeasForMonth(new Date().getMonth() + 1)
        .slice(0, MAX_CHIPS)
        .map((idea) => ({ key: idea.key, title: idea.title, category: idea.category }))
    : (payload?.topics ?? [])
        .slice(0, MAX_CHIPS)
        .map((topic) => ({
          key: topic.topicKey,
          title: topic.title,
          category: topic.category,
        }));

  return (
    <div>
      {query.isLoading && chips.length === 0 ? (
        <div className="space-y-2" aria-hidden>
          <Skeleton className="h-4 w-28" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-36 rounded-full" />
            ))}
          </div>
        </div>
      ) : chips.length === 0 ? null : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-section-title">{fallback ? 'Seasonal ideas' : 'Trending today'}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSeeAll}
              className="h-8 shrink-0 px-2 text-xs"
            >
              See all
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </div>
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {chips.map((chip) => {
              const Icon = TREND_CATEGORY_ICONS[chip.category] ?? TREND_CATEGORY_ICONS.other;
              return (
                <li key={chip.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenTopic(chip.key)}
                    className={CHIP_CLASS}
                  >
                    <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                    <span className="max-w-[9rem] truncate">{chip.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
