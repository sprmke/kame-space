import { Gauge, Sparkles, TrendingUp, Users } from 'lucide-react';

import { FeatureStatusDot } from '@/components/feature-availability/FeatureStatusDot';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';

import {
  ANALYTICS_SECTION_LABELS,
  analyticsPanelId,
  analyticsTabId,
  type AnalyticsSection,
} from '@/features/dashboard/analytics/lib/analyticsSection';

import { SlidingTabs, SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';

export type { AnalyticsSection };

const ANALYTICS_SECTION_TABS: Array<{
  value: AnalyticsSection;
  label: string;
  icon: typeof TrendingUp;
}> = [
  { value: 'overview', label: ANALYTICS_SECTION_LABELS.overview, icon: Gauge },
  { value: 'trends', label: ANALYTICS_SECTION_LABELS.trends, icon: TrendingUp },
  { value: 'guests', label: ANALYTICS_SECTION_LABELS.guests, icon: Users },
  { value: 'ai-review', label: ANALYTICS_SECTION_LABELS['ai-review'], icon: Sparkles },
];

type Props = {
  section: AnalyticsSection;
  onSectionChange: (section: AnalyticsSection) => void;
};

/** Section switcher for the Analytics dashboard. Period and actions live in the page header. */
export function AnalyticsSectionTabs({ section, onSectionChange }: Props) {
  const aiReviewAvailability = useFeatureAvailability('analytics.ai_review');

  return (
    <div className="relative min-w-0">
      <SlidingTabs
        value={section}
        onValueChange={(value) => onSectionChange(value as AnalyticsSection)}
      >
        <SlidingTabsList size="primary" className="max-w-full">
          {ANALYTICS_SECTION_TABS.map(({ value, label, icon: Icon }) => (
            <SlidingTabsTrigger
              key={value}
              value={value}
              id={analyticsTabId(value)}
              panelId={analyticsPanelId(value)}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
              {value === 'ai-review' &&
              !aiReviewAvailability.available &&
              !aiReviewAvailability.isLoading ? (
                <FeatureStatusDot className="ml-1" label={aiReviewAvailability.label} />
              ) : null}
            </SlidingTabsTrigger>
          ))}
        </SlidingTabsList>
      </SlidingTabs>
      {/* Phone strips are wider than the screen; the fade is the scroll affordance. */}
      <div
        aria-hidden
        className="from-background pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-lg bg-gradient-to-l to-transparent lg:hidden"
      />
    </div>
  );
}
