import { useMemo } from 'react';

import { useNotificationsList } from '@/features/dashboard/notifications/hooks/useNotifications';
import { propertyChannelSyncPath } from '@/features/dashboard/notifications/lib/notificationsPaths';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import type { DashboardAttentionItem } from '@/features/dashboard/property/lib/types';

/**
 * Surfaces unread calendar conflict / sync-failing notifications on Needs attention
 * so hosts can open Channel sync without hunting the bell.
 */
export function usePropertyCalendarConflictAttentionItem(): DashboardAttentionItem | null {
  const { orgSlug, propertySlug, property } = useOrgContext();
  const propertyId = property.id;
  const { data, isLoading } = useNotificationsList('preview');

  return useMemo(() => {
    if (isLoading || !propertyId) return null;

    const rows = (data?.pages ?? []).flatMap((page) => page.notifications);
    const matches = rows.filter(
      (row) =>
        !row.isRead &&
        row.property_id === propertyId &&
        (row.type === 'calendar_conflict' || row.type === 'calendar_sync_failing')
    );
    if (matches.length === 0) return null;

    const conflictCount = matches.filter((row) => row.type === 'calendar_conflict').length;
    const label =
      conflictCount > 0
        ? matches.length === 1
          ? 'Calendar conflict'
          : 'Calendar conflicts'
        : matches.length === 1
          ? 'Calendar sync failing'
          : 'Calendar sync issues';

    return {
      id: 'calendar-sync-attention',
      label,
      count: matches.length > 1 ? matches.length : undefined,
      href: propertyChannelSyncPath(orgSlug, propertySlug),
      severity: conflictCount > 0 ? 'critical' : 'warning',
    };
  }, [data?.pages, isLoading, orgSlug, propertyId, propertySlug]);
}
