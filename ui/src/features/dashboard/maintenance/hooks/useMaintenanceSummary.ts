import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchMaintenanceSummary } from '@/features/dashboard/maintenance/hooks/useMaintenanceApi';
import type { MaintenanceQuery } from '@/features/dashboard/maintenance/lib/types';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export const MAINTENANCE_SUMMARY_KEY = ['maintenance-summary'] as const;

export function useMaintenanceSummary(
  query: MaintenanceQuery,
  /** `enabled: false` holds the request until the caller is ready. Defaults to on. */
  options?: { enabled?: boolean }
) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: [...MAINTENANCE_SUMMARY_KEY, propertyId, query.from, query.to] as const,
    queryFn: () => fetchMaintenanceSummary(query, propertyId),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}
