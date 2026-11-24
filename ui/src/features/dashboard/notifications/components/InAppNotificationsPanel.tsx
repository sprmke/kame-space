import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useNavigate } from 'react-router-dom';

import { formatDistanceToNow } from 'date-fns';
import { BellOff } from 'lucide-react';

import { PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';
import { NotificationInboxTitle } from '@/features/dashboard/notifications/components/NotificationInboxTitle';
import { ActivityEmptyPanel } from '@/features/dashboard/notifications/components/NotificationsChannelPanels';
import { useEnrichedNotifications } from '@/features/dashboard/notifications/hooks/useEnrichedNotifications';
import {
  useMarkNotificationRead,
  useNotificationsList,
  type NotificationsListMode,
} from '@/features/dashboard/notifications/hooks/useNotifications';
import type { NotificationRecord } from '@/features/dashboard/notifications/lib/notificationsApi';
import { collapseInboxNotifications } from '@/features/dashboard/notifications/lib/notificationsCollapse';
import {
  formatNotificationDisplayTitle,
  formatNotificationInboxPlatformLabel,
  formatNotificationStayLabel,
  notificationIconFor,
  notificationInboxPlatform,
} from '@/features/dashboard/notifications/lib/notificationsDisplay';
import {
  resolveNotificationPath,
  type NotificationPathScope,
} from '@/features/dashboard/notifications/lib/notificationsPaths';

import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

type Props = {
  mode: NotificationsListMode;
  pathScope: NotificationPathScope;
  className?: string;
  /** Sheet (bell panel), dropdown (legacy), or the hub page's full-height feed. */
  variant?: 'sheet' | 'dropdown' | 'feed';
  /**
   * Scrollport that owns pagination for `variant="feed"`. The feed does not
   * scroll itself — the hub view's scrollport does — so the sentinel has to be
   * observed against that element. Pagination starts once it resolves.
   */
  scrollRoot?: HTMLElement | null;
  onNavigate?: () => void;
};

export function InAppNotificationsPanel({
  mode,
  pathScope,
  className,
  variant = 'feed',
  scrollRoot,
  onNavigate,
}: Props) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useNotificationsList(mode);
  const markRead = useMarkNotificationRead();

  const rawNotifications = data?.pages.flatMap((page) => page.notifications) ?? [];
  const enrichedNotifications = useEnrichedNotifications(rawNotifications);
  const notifications = collapseInboxNotifications(enrichedNotifications);
  const hasMoreOnServer = Boolean(data?.pages[0]?.nextCursor);

  loadingMoreRef.current = isFetchingNextPage;

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || loadingMoreRef.current) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage]);

  useEffect(() => {
    if (variant !== 'feed' || !hasNextPage) return;

    const sentinel = sentinelRef.current;
    // The hub renders the feed inside the admin content scrollport; use it when
    // the caller did not hand a root in, so scroll paging keeps working there.
    const root =
      scrollRoot ?? sentinel?.closest<HTMLElement>('[data-admin-content-scroll]') ?? null;
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
  }, [variant, hasNextPage, handleLoadMore, notifications.length, scrollRoot]);

  const handleRowClick = (notification: NotificationRecord, path: string) => {
    captureAppEvent('notification_opened', { channel: 'in_app', kind: notification.type });
    if (!notification.isRead) markRead.mutate(notification.id);
    onNavigate?.();
    navigate(path);
  };

  const listScrollClassName = useMemo(() => {
    if (variant === 'sheet') {
      return 'min-h-0 flex-1 overflow-y-auto overscroll-contain';
    }
    if (variant === 'dropdown') {
      return 'max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain';
    }
    /* Feed: Activity card scrollport owns scroll (header stays pinned above). */
    return undefined;
  }, [variant]);

  if (isLoading) {
    return (
      <div className={cn('px-4 py-3', className)}>
        <ListRowsSkeleton rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 px-6 text-center',
          variant === 'feed' ? 'min-h-[min(50dvh,22rem)] py-12' : 'px-4 py-6',
          className
        )}
      >
        <p className="text-muted-foreground text-sm">Could not load notifications.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (notifications.length === 0) {
    /* Hub feed gets the centered empty; bell/sheet stays a short line. */
    if (variant === 'feed') {
      return <ActivityEmptyPanel className={className} />;
    }

    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 px-4 py-10 text-center',
          className
        )}
      >
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <BellOff className="size-4" aria-hidden />
        </span>
        <p className="text-muted-foreground text-sm">No notifications yet.</p>
      </div>
    );
  }

  return (
    <div
      className={cn('min-w-0', variant === 'sheet' && 'flex min-h-0 flex-1 flex-col', className)}
    >
      <div ref={scrollRef} className={listScrollClassName}>
        <ul aria-label="Notifications" className="divide-border divide-y">
          {notifications.map((notification) => {
            const Icon = notificationIconFor(notification.type);
            const stayLabel = formatNotificationStayLabel(notification.metadata);
            const inboxPlatform = notificationInboxPlatform(notification.metadata);
            const platformLabel = formatNotificationInboxPlatformLabel(notification.metadata);
            const unread = !notification.isRead;
            /*
             * A row with no destination must not look tappable: the old handler
             * marked it read and then stayed put, so the unread dot vanished for
             * nothing. Static rows stay readable and "Mark all as read" still works.
             */
            const path = resolveNotificationPath(notification, pathScope);
            const rowClassName = cn(
              'flex min-h-[44px] w-full items-start gap-2.5 border-l-2 px-3 py-2.5 text-left sm:gap-3 sm:px-4',
              path && 'hover:bg-muted/50 transition-colors',
              unread ? 'border-l-primary bg-primary/[0.06]' : 'border-l-transparent',
              variant === 'feed' && 'sm:py-3'
            );
            const rowContent = (
              <>
                {notification.type === 'inbox_new_message' && inboxPlatform ? (
                  <PlatformLogo
                    platform={inboxPlatform}
                    size="xs"
                    className="mt-0.5 size-7 shrink-0 rounded-full sm:size-8"
                  />
                ) : (
                  <span
                    className={cn(
                      'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full sm:size-8',
                      unread ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="size-3.5 sm:size-4" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 flex-1 items-start justify-between gap-2">
                    {notification.type === 'inbox_new_message' && platformLabel ? (
                      <NotificationInboxTitle
                        name={formatNotificationDisplayTitle(notification)}
                        platformLabel={platformLabel}
                        nameClassName={cn(
                          'text-[13px] sm:text-sm',
                          unread ? 'font-semibold' : 'font-medium'
                        )}
                      />
                    ) : (
                      <span
                        className={cn(
                          'truncate text-[13px] sm:text-sm',
                          unread ? 'font-semibold' : 'font-medium'
                        )}
                      >
                        {formatNotificationDisplayTitle(notification)}
                      </span>
                    )}
                    {unread ? (
                      <span className="bg-primary mt-1 size-2 shrink-0 rounded-full" aria-hidden />
                    ) : null}
                    {unread ? <span className="sr-only">Unread</span> : null}
                  </span>
                  {stayLabel ? (
                    <span className="text-muted-foreground mt-0.5 block text-[11px] tabular-nums sm:text-xs">
                      {stayLabel}
                    </span>
                  ) : null}
                  {notification.body ? (
                    <span className="text-muted-foreground mt-0.5 line-clamp-1 block text-[11px] sm:line-clamp-2 sm:text-xs">
                      {notification.body}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground mt-0.5 block text-[10px] sm:mt-1 sm:text-[11px]">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </span>
              </>
            );
            return (
              <li key={notification.id}>
                {path ? (
                  <button
                    type="button"
                    onClick={() => handleRowClick(notification, path)}
                    className={rowClassName}
                  >
                    {rowContent}
                  </button>
                ) : (
                  <div className={rowClassName}>{rowContent}</div>
                )}
              </li>
            );
          })}
        </ul>

        {(hasNextPage || isFetchingNextPage) && mode === 'full' ? (
          <div ref={sentinelRef} role="status" aria-live="polite" aria-busy={isFetchingNextPage}>
            {isFetchingNextPage ? (
              <div className="px-4 pb-2 pt-1">
                <ListRowsSkeleton rows={2} />
              </div>
            ) : (
              <div className="min-h-[48px]" aria-hidden />
            )}
          </div>
        ) : null}
      </div>

      {(variant === 'sheet' || variant === 'dropdown') && mode === 'preview' && hasMoreOnServer ? (
        <span className="sr-only">More notifications available on the Notifications page.</span>
      ) : null}
    </div>
  );
}
