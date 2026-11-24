import { Filter, Landmark } from 'lucide-react';

import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import {
  DEVELOPMENT_STATUSES,
  DEVELOPMENT_TYPES,
} from '@/features/dashboard/super-admin/lib/developmentSettingsConstants';
import type {
  SuperAdminDevelopmentsFilters,
  SuperAdminDevelopmentsViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminDevelopmentsFilters';

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
  filters: SuperAdminDevelopmentsFilters;
  viewMode: SuperAdminDevelopmentsViewMode;
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: SuperAdminDevelopmentsFilters['status']) => void;
  onTypeChange: (value: string) => void;
  onViewModeChange: (mode: SuperAdminDevelopmentsViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminDevelopmentsToolbar({
  filters,
  viewMode,
  hideTableView = false,
  limit,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onViewModeChange,
  onLimitChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <AdminSearchInput
          value={filters.search}
          onChange={onSearchChange}
          placeholder="Search developments…"
          ariaLabel="Search developments"
        />

        <Select
          value={filters.status}
          onValueChange={(value) =>
            onStatusChange(value as SuperAdminDevelopmentsFilters['status'])
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
            {DEVELOPMENT_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={onTypeChange}>
          <SelectTrigger
            className="h-10 w-[min(100%,9.5rem)] shrink-0 sm:w-[9.5rem]"
            aria-label="Filter by type"
          >
            <Landmark className="size-4 shrink-0 opacity-70" aria-hidden />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DEVELOPMENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
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

export function SuperAdminDevelopmentsResultsMeta({
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
