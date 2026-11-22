import { usePropertySettingsCopyLogs } from '@/features/dashboard/org/hooks/usePropertySettingsCopyLogs';
import type { PropertySettingsCopyLogEntry } from '@/features/dashboard/org/lib/copyPropertySettingsApi';
import { COPY_PROPERTY_SETTINGS_GROUPS } from '@/features/dashboard/org/lib/copyPropertySettingsGroups';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  orgSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyNameById: Map<string, string>;
};

function groupLabel(id: string): string {
  return COPY_PROPERTY_SETTINGS_GROUPS.find((g) => g.id === id)?.label ?? id;
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function summarizeLog(
  log: PropertySettingsCopyLogEntry,
  propertyNameById: Map<string, string>
): string {
  const source = propertyNameById.get(log.source_property_id) ?? 'Source';
  const targetCount = log.target_property_ids.length;
  const groupCount = log.groups.length;
  return `${source} → ${targetCount} ${targetCount === 1 ? 'property' : 'properties'} · ${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`;
}

function HistoryList({
  logs,
  propertyNameById,
}: {
  logs: PropertySettingsCopyLogEntry[];
  propertyNameById: Map<string, string>;
}) {
  return (
    <ul className="space-y-2.5" role="list">
      {logs.map((log) => {
        const groupPreview = log.groups.slice(0, 4).map(groupLabel).join(', ');
        const more = log.groups.length > 4 ? ` +${log.groups.length - 4}` : '';
        return (
          <li
            key={log.id}
            className="border-border bg-card flex min-h-[4.5rem] items-start justify-between gap-3 rounded-xl border px-3.5 py-3.5 sm:gap-4 sm:px-4"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-foreground text-sm font-medium leading-snug">
                {summarizeLog(log, propertyNameById)}
              </p>
              <p className="text-muted-foreground text-xs leading-snug sm:text-[13px]">
                {groupPreview}
                {more}
              </p>
            </div>
            <time
              className="text-muted-foreground mt-0.5 shrink-0 text-right text-xs tabular-nums leading-snug"
              dateTime={log.created_at}
            >
              {formatWhen(log.created_at)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}

export function CopyPropertySettingsHistoryDialog({
  orgSlug,
  open,
  onOpenChange,
  propertyNameById,
}: Props) {
  const { data, isPending, isError, isFetching } = usePropertySettingsCopyLogs(orgSlug, open);
  const logs = data?.logs ?? [];
  const showLoading = open && (isPending || (isFetching && logs.length === 0));

  return (
    <AdminDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Copy history"
      sizeClassName="max-w-[min(calc(100vw-1.5rem),32rem)] sm:max-w-[min(90vw,32rem)]"
      footer={
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      }
    >
      {showLoading ? (
        <ul className="space-y-2.5" aria-busy="true" aria-label="Loading copy history">
          {Array.from({ length: 3 }).map((_, index) => (
            <li
              key={index}
              className="border-border flex min-h-[4.5rem] items-start justify-between gap-3 rounded-xl border px-3.5 py-3.5 sm:px-4"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-[70%]" />
                <Skeleton className="h-3.5 w-[55%]" />
              </div>
              <Skeleton className="mt-0.5 h-3 w-[5.5rem] shrink-0" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <p className="text-muted-foreground text-sm">Could not load history.</p>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No copy runs yet.</p>
      ) : (
        <HistoryList logs={logs} propertyNameById={propertyNameById} />
      )}
    </AdminDialogShell>
  );
}
