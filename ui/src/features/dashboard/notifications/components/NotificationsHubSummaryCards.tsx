import { Bell, Link2, MessageCircle, Send } from 'lucide-react';

import type { TelegramHubStats } from '@/features/dashboard/notifications/hooks/useTelegramHubStats';
import type { NotificationsUnreadSummary } from '@/features/dashboard/notifications/lib/notificationsApi';
import { NOTIFICATIONS_HELP_COPY } from '@/features/dashboard/notifications/lib/notificationsHelpCopy';

import { InfoHint } from '@/components/help/InfoHint';
import { StatCard, StatCardGrid, StatCardSkeleton } from '@/components/shared/StatCard';

/** "0 of 6" reads as a count; "0/6" reads as a date or a fraction. */
function ratioValue(numerator: number, denominator: number): string {
  return `${numerator} of ${denominator}`;
}

type Props = {
  unreadCount: number;
  summary: NotificationsUnreadSummary | undefined;
  activityLoading?: boolean;
  /** The list request failed, so a `0` would be a lie. */
  activityError?: boolean;
  telegram: TelegramHubStats;
  onFocusActivity?: () => void;
  onFocusTelegram?: () => void;
};

const NOTIFICATIONS_METRICS = [
  { title: 'Unread', icon: Bell, hasHint: false },
  { title: 'Messages', icon: MessageCircle, hasHint: true },
  { title: 'Telegram on', icon: Send, hasHint: true },
  { title: 'Connected', icon: Link2, hasHint: true },
];

export function NotificationsHubSummaryCardsSkeleton() {
  return (
    <StatCardGrid className="lg:grid-cols-2 xl:grid-cols-4">
      {NOTIFICATIONS_METRICS.map((metric) => (
        <StatCardSkeleton
          key={metric.title}
          title={metric.title}
          icon={metric.icon}
          titleAdornment={
            metric.hasHint ? <span aria-hidden className="h-4 w-6 shrink-0" /> : undefined
          }
        />
      ))}
    </StatCardGrid>
  );
}

export function NotificationsHubSummaryCards({
  unreadCount,
  summary,
  activityLoading,
  activityError = false,
  telegram,
  onFocusActivity,
  onFocusTelegram,
}: Props) {
  const activityPending = activityLoading && summary === undefined && unreadCount === 0;
  const telegramPending = telegram.isLoading;

  if (activityPending && telegramPending) {
    return <NotificationsHubSummaryCardsSkeleton />;
  }

  const inbox = summary?.inbox ?? 0;
  const { moduleCount, enabledCount, connectedCount } = telegram;
  /* A failed list is not "zero unread": say so instead of showing a clean 0. */
  const activityValue = (value: number) => (activityError ? 'n/a' : String(value));

  return (
    <StatCardGrid className="lg:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Unread"
        value={activityValue(unreadCount)}
        icon={Bell}
        onClick={onFocusActivity}
      />
      <StatCard
        title="Messages"
        value={activityValue(inbox)}
        icon={MessageCircle}
        onClick={onFocusActivity}
        titleAdornment={
          <InfoHint
            label="Messages"
            text={NOTIFICATIONS_HELP_COPY.messages.hint}
            variant="metric"
          />
        }
      />
      <StatCard
        title="Telegram on"
        value={ratioValue(enabledCount, moduleCount)}
        icon={Send}
        onClick={onFocusTelegram}
        titleAdornment={
          <InfoHint
            label="Telegram on"
            text={NOTIFICATIONS_HELP_COPY.telegramOn.hint}
            variant="metric"
          />
        }
      />
      <StatCard
        title="Connected"
        value={ratioValue(connectedCount, moduleCount)}
        icon={Link2}
        onClick={onFocusTelegram}
        titleAdornment={
          <InfoHint
            label="Connected"
            text={NOTIFICATIONS_HELP_COPY.connected.hint}
            variant="metric"
          />
        }
      />
    </StatCardGrid>
  );
}
