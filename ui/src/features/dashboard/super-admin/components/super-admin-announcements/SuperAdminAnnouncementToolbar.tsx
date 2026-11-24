import { Filter } from 'lucide-react';

import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import {
  ANNOUNCEMENT_SEVERITY_LABELS,
  type SuperAdminAnnouncementFilters,
  type SuperAdminAnnouncementViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminAnnouncementFilters';

import { AdminSearchInput } from '@/components/navigation/AdminSearchInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';


type Props = {
  filters: SuperAdminAnnouncementFilters;
  viewMode: SuperAdminAnnouncementViewMode;
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onSeverityChange: (value: SuperAdminAnnouncementFilters['severity']) => void;
  onStatusChange: (value: SuperAdminAnnouncementFilters['status']) => void;
  onViewModeChange: (mode: SuperAdminAnnouncementViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminAnnouncementToolbar({
  filters,
  viewMode,
  hideTableView = false,
  limit,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
  onViewModeChange,
  onLimitChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <AdminSearchInput
          value={filters.search}
          onChange={onSearchChange}
          placeholder="Search announcements…"
          ariaLabel="Search announcements"
        />

        <Select
          value={filters.severity}
          onValueChange={(value) =>
            onSeverityChange(value as SuperAdminAnnouncementFilters['severity'])
          }
        >
          <SelectTrigger
            className="h-10 w-[min(100%,10.5rem)] shrink-0 sm:w-[10.5rem]"
            aria-label="Filter by severity"
          >
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {Object.entries(ANNOUNCEMENT_SEVERITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            onStatusChange(value as SuperAdminAnnouncementFilters['status'])
          }
        >
          <SelectTrigger
            className="h-10 w-[min(100%,9.5rem)] shrink-0 sm:w-[9.5rem]"
            aria-label="Filter by status"
          >
            <Filter className="size-4 shrink-0 opacity-70" aria-hidden />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <AdminListPerPageSelect limit={limit} onChange={onLimitChange} />
        <SuperAdminListViewToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          hideTableView={hideTableView}
        />
      </div>
    </div>
  );
}

export function SuperAdminAnnouncementResultsMeta({
  visibleCount,
  totalCount,
}: {
  visibleCount: number;
  totalCount: number;
}) {
  if (totalCount === 0) return null;
  return (
    <p className={cn('text-muted-foreground text-xs sm:text-sm')}>
      Showing {visibleCount} of {totalCount}
    </p>
  );
}
