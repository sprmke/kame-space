import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type SuperAdminAuditEvent = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type AuditResponse = {
  events: SuperAdminAuditEvent[];
  total: number;
  page: number;
  limit: number;
};

export function useSuperAdminAudit(params: {
  page: number;
  limit: number;
  q?: string;
  actor?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
}) {
  const search = new URLSearchParams();
  search.set('page', String(params.page));
  search.set('limit', String(params.limit));
  if (params.q) search.set('q', params.q);
  if (params.actor) search.set('actor', params.actor);
  if (params.action) search.set('action', params.action);
  if (params.targetType) search.set('targetType', params.targetType);
  if (params.targetId) search.set('targetId', params.targetId);

  return useQuery({
    queryKey: ['super-admin', 'audit', params],
    placeholderData: keepPreviousData,
    queryFn: () => callEdgeFunction<AuditResponse>(`list-super-admin-audit?${search.toString()}`),
    staleTime: 15_000,
  });
}

export type SuperAdminAuditFacets = {
  actions: string[];
  targetTypes: string[];
};

/** Distinct action and target values, used to populate the audit filters. */
export function useSuperAdminAuditFacets() {
  return useQuery({
    queryKey: ['super-admin', 'audit', 'facets'],
    queryFn: () => callEdgeFunction<SuperAdminAuditFacets>('list-super-admin-audit?facets=true'),
    staleTime: 5 * 60_000,
  });
}
