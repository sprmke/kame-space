import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  fetchTelegramHistory,
  type TelegramHistoryPage,
} from '@/features/dashboard/notifications/lib/telegramHistoryApi';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export function telegramHistoryKey(scopeKey: string, cursor: string | null) {
  return ['telegram-history', scopeKey, cursor] as const;
}

export function telegramHistoryInfiniteKey(scopeKey: string) {
  return ['telegram-history-infinite', scopeKey] as const;
}

/** One history page. Callers walk a cursor stack (see notificationPager). */
export function useTelegramHistoryPage(cursor: string | null) {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);

  return useQuery<TelegramHistoryPage>({
    queryKey: telegramHistoryKey(scopeKey, cursor),
    queryFn: () => fetchTelegramHistory(scope, cursor),
    staleTime: 60_000,
  });
}

/**
 * Scroll-to-load Telegram history (same page size as the single-page API).
 * Only mounts on the Telegram hub tab, so Activity does not fetch this.
 */
export function useTelegramHistoryInfinite(options: { enabled?: boolean } = {}) {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);

  return useInfiniteQuery({
    queryKey: telegramHistoryInfiniteKey(scopeKey),
    queryFn: ({ pageParam }) => fetchTelegramHistory(scope, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60_000,
    enabled: options.enabled !== false,
  });
}
