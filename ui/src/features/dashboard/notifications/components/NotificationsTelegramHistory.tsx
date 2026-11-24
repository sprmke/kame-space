import { useCallback, useEffect, useRef, useState } from 'react';

import { formatDistanceToNow } from 'date-fns';

import {
  TelegramHistoryEmptyPanel,
  TelegramPausedPanel,
} from '@/features/dashboard/notifications/components/NotificationsChannelPanels';
import { useTelegramDeliveryControl } from '@/features/dashboard/notifications/hooks/useTelegramDeliveryControl';
import { useTelegramHistoryInfinite } from '@/features/dashboard/notifications/hooks/useTelegramHistory';
import {
  telegramHistoryPreview,
  telegramModuleMeta,
} from '@/features/dashboard/notifications/lib/telegramHistory';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Read-only copy of what each Telegram group received.
 *
 * Delivery lives in Manage only (same as Activity push). The list scrolls and
 * loads older pages (20 at a time, 15-day window). Nothing here calls Telegram.
 */
export function NotificationsTelegramHistory() {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const { data: delivery, isLoading: deliveryLoading } = useTelegramDeliveryControl();
  const deliveryEnabled = delivery?.enabled !== false;

  const {
    data,
    isFetching,
    isFetchingNextPage,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isLoading,
  } = useTelegramHistoryInfinite({ enabled: !deliveryLoading && deliveryEnabled });

  const messages = data?.pages.flatMap((page) => page.messages) ?? [];
  const retentionDays = data?.pages[0]?.retentionDays ?? 15;
  const showSkeleton = ((isLoading || isFetching) && data === undefined) || deliveryLoading;
  loadingMoreRef.current = isFetchingNextPage;

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || loadingMoreRef.current) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage]);

  useEffect(() => {
    if (!hasNextPage || !deliveryEnabled) return;
    const sentinel = sentinelRef.current;
    const root = scrollRoot;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMoreRef.current) {
          handleLoadMore();
        }
      },
      { root, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, handleLoadMore, messages.length, scrollRoot, deliveryEnabled]);

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        bottomTabBarOffsetClassName()
      )}
    >
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
          <h2 className="text-card-title">Telegram</h2>
          <span className="text-muted-foreground text-xs">Last {retentionDays} days</span>
        </div>

        <div
          ref={setScrollRoot}
          /* Clear the floating Quick access pill so the last row is reachable. */
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-16"
        >
          {showSkeleton ? (
            <div className="px-4 py-3">
              <ListRowsSkeleton rows={6} />
            </div>
          ) : (
            <>
              {!deliveryEnabled ? <TelegramPausedPanel variant="feed" /> : null}
              {isError ? (
                <div className="flex min-h-[min(50dvh,22rem)] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <p className="text-muted-foreground text-sm">Could not load Telegram messages.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                    Retry
                  </Button>
                </div>
              ) : null}
              {deliveryEnabled && !isError && messages.length === 0 ? (
                <TelegramHistoryEmptyPanel retentionDays={retentionDays} />
              ) : null}
              {deliveryEnabled && !isError && messages.length > 0 ? (
                <>
                  <ul className="divide-border divide-y">
                    {messages.map((message) => {
                      const meta = telegramModuleMeta(message.module);
                      const Icon = meta.icon;
                      const { preview, truncated } = telegramHistoryPreview(message.text);
                      const isExpanded = expanded.has(message.id);
                      const failed = message.status === 'failed';
                      return (
                        <li key={message.id} className="px-3 py-2.5 sm:px-4 sm:py-3">
                          <div className="flex items-start gap-2.5 sm:gap-3">
                            <span
                              className={cn(
                                'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full sm:size-8',
                                failed
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-primary/10 text-primary'
                              )}
                            >
                              <Icon className="size-3.5 sm:size-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="text-foreground text-[13px] font-semibold sm:text-sm">
                                  {meta.label}
                                </span>
                                {failed ? (
                                  <span className="bg-destructive/10 text-destructive rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                    Failed
                                  </span>
                                ) : null}
                                <span className="text-muted-foreground text-[11px] sm:text-xs">
                                  {formatDistanceToNow(new Date(message.createdAt), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>

                              <p
                                className={cn(
                                  'text-muted-foreground mt-1 whitespace-pre-line text-[12px] leading-relaxed sm:text-[13px]',
                                  !isExpanded && 'line-clamp-3'
                                )}
                              >
                                {isExpanded ? message.text : preview}
                              </p>

                              {failed && message.error ? (
                                <p className="text-destructive mt-1 text-[11px] sm:text-xs">
                                  {message.error}
                                </p>
                              ) : null}

                              {truncated || isExpanded ? (
                                <button
                                  type="button"
                                  className="text-primary mt-1 min-h-[44px] text-xs font-semibold hover:underline"
                                  onClick={() => toggleExpanded(message.id)}
                                >
                                  {isExpanded ? 'Show less' : 'Show more'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {hasNextPage || isFetchingNextPage ? (
                    <div
                      ref={sentinelRef}
                      role="status"
                      aria-live="polite"
                      aria-busy={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? (
                        <div className="px-4 pb-2 pt-1">
                          <ListRowsSkeleton rows={2} />
                        </div>
                      ) : (
                        <div className="min-h-[48px]" aria-hidden />
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
