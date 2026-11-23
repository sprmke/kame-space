import { useQuery } from '@tanstack/react-query';

import { listPropertySettingsCopyLogs } from '@/features/dashboard/org/lib/copyPropertySettingsApi';

export function copyPropertySettingsLogsQueryKey(orgSlug: string | undefined) {
  return ['property-settings-copy-logs', orgSlug] as const;
}

export function usePropertySettingsCopyLogs(orgSlug: string | undefined, enabled = true) {
  return useQuery({
    queryKey: copyPropertySettingsLogsQueryKey(orgSlug),
    enabled: Boolean(orgSlug) && enabled,
    queryFn: () => listPropertySettingsCopyLogs({ orgSlug: orgSlug! }),
  });
}

/** Header History button: show only when the org has at least one copy log. */
export function useHasPropertySettingsCopyHistory(orgSlug: string | undefined): boolean {
  const { data, isPending, isError } = usePropertySettingsCopyLogs(orgSlug);
  if (isPending || isError) return false;
  return (data?.logs?.length ?? 0) > 0;
}
