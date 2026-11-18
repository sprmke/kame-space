import { useCallback, useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import {
  fetchOrgPlan,
  type OrgPaymentTransactionDto,
  type OrgPlanResponse,
} from '@/features/dashboard/plans/lib/orgPlanApi';

/**
 * Payment history for the Billing tab: the first page rides along with `org-plan`, "Show more"
 * pages by cursor, and a toggle brings back unpaid and canceled checkouts (hidden by default).
 */
export function useOrgPaymentHistory(orgId: string | null, data: OrgPlanResponse | undefined) {
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [more, setMore] = useState<{
    items: OrgPaymentTransactionDto[];
    cursor: string | null;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const incomplete = useQuery({
    queryKey: ['org', orgId, 'plan', 'history', 'incomplete'],
    queryFn: () => fetchOrgPlan(orgId!, { includeIncomplete: true }),
    enabled: showIncomplete && Boolean(orgId),
    staleTime: 30_000,
  });

  const source = showIncomplete ? incomplete.data : data;
  const first = source?.transactions ?? [];
  const firstCursor = source?.transactionsNextCursor ?? null;
  const firstId = first[0]?.id ?? null;

  // A new payment at the top, or switching the toggle, starts the list over.
  useEffect(() => {
    setMore(null);
  }, [firstId, showIncomplete]);

  const cursor = more ? more.cursor : firstCursor;

  const loadMore = useCallback(async () => {
    if (!orgId || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchOrgPlan(orgId, { cursor, includeIncomplete: showIncomplete });
      setMore((current) => ({
        items: [...(current?.items ?? []), ...page.transactions],
        cursor: page.transactionsNextCursor ?? null,
      }));
    } finally {
      setLoadingMore(false);
    }
  }, [orgId, cursor, loadingMore, showIncomplete]);

  return {
    transactions: [...first, ...(more?.items ?? [])],
    hasMore: Boolean(cursor),
    isLoadingMore: loadingMore || (showIncomplete && incomplete.isLoading),
    loadMore,
    showIncomplete,
    setShowIncomplete,
  };
}
