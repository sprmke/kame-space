import { useMemo, useState } from 'react';

import { InAppNotificationsPanel } from '@/features/dashboard/notifications/components/InAppNotificationsPanel';
import {
  useMarkAllNotificationsRead,
  useNotificationsList,
} from '@/features/dashboard/notifications/hooks/useNotifications';
import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';
import { SyncCenterCard } from '@/features/dashboard/offline/components/SyncCenterCard';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * In-app activity view of the Notifications hub.
 *
 * Sync Center (when needed) sits above the card. The Activity title + Mark all
 * row is pinned; only the feed scrolls and pages (20 per request).
 */
export function NotificationsActivityView() {
  const { orgSlug } = useNotificationsOrgScope();
  const { data: propertiesData } = useProperties(orgSlug ?? undefined);
  const { data: parkingsData } = useParkings(orgSlug ?? undefined);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  /* Same query the hub and the bell hold, so the unread count is already cached. */
  const { data: preview } = useNotificationsList('preview');
  const unreadCount = preview?.pages[0]?.unreadCount ?? 0;
  const markAllRead = useMarkAllNotificationsRead();

  const propertySlugById = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of propertiesData?.properties ?? []) map.set(property.id, property.slug);
    return map;
  }, [propertiesData]);

  const parkingSlugById = useMemo(() => {
    const map = new Map<string, string>();
    for (const parking of parkingsData?.parkings ?? []) map.set(parking.id, parking.slug);
    return map;
  }, [parkingsData]);

  const pathScope = useMemo(
    () => ({ orgSlug, propertySlugById, parkingSlugById }),
    [orgSlug, propertySlugById, parkingSlugById]
  );

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        bottomTabBarOffsetClassName()
      )}
    >
      {/* Returns null when empty so hub tab→card spacing matches Telegram. */}
      <SyncCenterCard className="mb-3 shrink-0 sm:mb-4" />
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
          <h2 className="text-card-title">Activity</h2>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-primary h-8 px-2"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Mark all as read
            </Button>
          ) : null}
        </div>
        <div
          ref={setScrollRoot}
          data-admin-content-scroll
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <InAppNotificationsPanel
            mode="full"
            pathScope={pathScope}
            variant="feed"
            scrollRoot={scrollRoot}
          />
        </div>
      </Card>
    </div>
  );
}
