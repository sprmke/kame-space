import { useCallback, useMemo, useState } from 'react';

import { ChevronDown, ScrollText } from 'lucide-react';

import {
  AdminListPagination,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import { useAdminListPaginationParams } from '@/features/dashboard/super-admin/hooks/useAdminListPaginationParams';
import {
  useSuperAdminAudit,
  useSuperAdminAuditFacets,
  type SuperAdminAuditEvent,
} from '@/features/dashboard/super-admin/hooks/useSuperAdminAudit';
import { auditActionLabel, auditTargetLabel } from '@/features/dashboard/super-admin/lib/superAdminAuditLabels';
import { formatSuperAdminDateTime, parseSuperAdminDate } from '@/features/dashboard/super-admin/lib/superAdminDates';

import { AdminSearchInput } from '@/components/navigation/AdminSearchInput';
import { SuperAdminAuditBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildPageItems } from '@/lib/table/pagination';

const ALL = 'all';

function relativeTime(iso: string): string {
  const date = parseSuperAdminDate(iso);
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AuditEventCard({ event }: { event: SuperAdminAuditEvent }) {
  const [open, setOpen] = useState(false);
  const hasMetadata = Object.keys(event.metadata ?? {}).length > 0;

  return (
    <Card padding="sm" className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{event.summary}</p>
        <span
          className="text-muted-foreground shrink-0 text-xs"
          title={formatSuperAdminDateTime(event.createdAt)}
        >
          {relativeTime(event.createdAt)}
        </span>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        <span>{auditActionLabel(event.action)}</span>
        <span aria-hidden>·</span>
        <span className="break-all">{event.actorEmail}</span>
        {event.targetType ? (
          <>
            <span aria-hidden>·</span>
            <span>{auditTargetLabel(event.targetType)}</span>
          </>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground mt-1 inline-flex min-h-[32px] w-fit items-center gap-1 text-xs font-medium"
      >
        Details
        <ChevronDown className={open ? 'size-3.5 rotate-180 transition-transform' : 'size-3.5 transition-transform'} aria-hidden />
      </button>
      {open ? (
        <div className="border-border mt-1 space-y-2 border-t pt-2 text-xs">
          <dl className="grid gap-1 sm:grid-cols-[7rem_1fr]">
            <dt className="text-muted-foreground">When</dt>
            <dd>{formatSuperAdminDateTime(event.createdAt)}</dd>
            <dt className="text-muted-foreground">Action</dt>
            <dd className="break-all font-mono">{event.action}</dd>
            <dt className="text-muted-foreground">Target</dt>
            <dd className="break-all">
              {event.targetType ?? 'none'}
              {event.targetId ? ` · ${event.targetId}` : ''}
            </dd>
          </dl>
          {hasMetadata ? (
            <div className="space-y-1">
              <p className="text-muted-foreground">Metadata</p>
              <pre className="bg-muted max-h-56 overflow-auto rounded-md p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-muted-foreground">No extra metadata recorded.</p>
          )}
        </div>
      ) : null}
    </Card>
  );
}

export function SuperAdminAuditPage() {
  const { searchParams, setSearchParams, page, limit, setPage, setLimit } =
    useAdminListPaginationParams();
  const q = searchParams.get('q') ?? '';
  const actor = searchParams.get('actor') ?? '';
  const action = searchParams.get('action') ?? ALL;
  const targetType = searchParams.get('targetType') ?? ALL;

  const { data, isLoading, isFetching, error, refetch } = useSuperAdminAudit({
    page,
    limit,
    q,
    actor,
    action: action === ALL ? undefined : action,
    targetType: targetType === ALL ? undefined : targetType,
  });
  const { data: facets } = useSuperAdminAuditFacets();
  const events = data?.events ?? [];
  // Facets cover history; the current page backfills them so the filter still
  // populates while an older deployment has not shipped the facets branch yet.
  const actionOptions = useMemo(() => {
    const values = new Set(facets?.actions ?? []);
    for (const event of events) values.add(event.action);
    return [...values].sort();
  }, [facets?.actions, events]);
  const targetTypeOptions = useMemo(() => {
    const values = new Set(facets?.targetTypes ?? []);
    for (const event of events) if (event.targetType) values.add(event.targetType);
    return [...values].sort();
  }, [facets?.targetTypes, events]);
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const patchFilter = useCallback(
    (key: 'q' | 'actor' | 'action' | 'targetType', value: string) =>
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (value && value !== ALL) sp.set(key, value);
          else sp.delete(key);
          sp.delete('page');
          return sp;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  const hasFilters = Boolean(q || actor || action !== ALL || targetType !== ALL);

  return (
    <SuperAdminPage
      title="Audit log"
      subtitle="Every super-admin mutation: plan assigns, verification decisions, payout disbursements, AI settings, credit adjustments."
      isLoading={isLoading && !data}
      loadingBody={<SuperAdminAuditBodySkeleton />}
      error={error}
      errorMessage="Could not load the audit log."
      onRetry={() => void refetch()}
    >
      <div className="flex flex-wrap items-center gap-2">
        <AdminSearchInput
          value={q}
          onChange={(value) => patchFilter('q', value)}
          placeholder="Search actions…"
          ariaLabel="Search audit log"
          className="min-w-[min(100%,14rem)] sm:max-w-xs"
        />
        <Input
          value={actor}
          onChange={(event) => patchFilter('actor', event.target.value)}
          placeholder="Actor email"
          className="h-10 w-[min(100%,12rem)] sm:w-[12rem]"
          aria-label="Filter by actor email"
        />
        <Select value={action} onValueChange={(value) => patchFilter('action', value)}>
          <SelectTrigger
            className="h-10 w-[min(100%,12rem)] sm:w-[12rem]"
            aria-label="Filter by action"
          >
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {actionOptions.map((value) => (
              <SelectItem key={value} value={value}>
                {auditActionLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={targetType} onValueChange={(value) => patchFilter('targetType', value)}>
          <SelectTrigger
            className="h-10 w-[min(100%,11rem)] sm:w-[11rem]"
            aria-label="Filter by target type"
          >
            <SelectValue placeholder="All targets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All targets</SelectItem>
            {targetTypeOptions.map((value) => (
              <SelectItem key={value} value={value}>
                {auditTargetLabel(value) ?? value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <AdminListPerPageSelect limit={limit} onChange={setLimit} />
        </div>
      </div>

      {events.length === 0 ? (
        <SuperAdminEmptyState
          icon={ScrollText}
          title={hasFilters ? 'No matching actions' : 'No actions recorded yet'}
        />
      ) : (
        <>
          <ol className="space-y-2">
            {events.map((event) => (
              <li key={event.id}>
                <AuditEventCard event={event} />
              </li>
            ))}
          </ol>

          <p className="text-muted-foreground text-xs sm:text-sm">
            Showing {events.length} of {total}
          </p>

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Audit log pagination"
              page={page}
              pageCount={pageCount}
              pageItems={buildPageItems(page, pageCount)}
              isLoading={isLoading || isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </SuperAdminPage>
  );
}
