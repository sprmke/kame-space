
import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import type {
  SuperAdminHostsFilters,
  SuperAdminHostsViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminHostsFilters';

import { AdminSearchInput } from '@/components/navigation/AdminSearchInput';
import { cn } from '@/lib/utils';

type Props = {
  filters: SuperAdminHostsFilters;
  viewMode: SuperAdminHostsViewMode;
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onViewModeChange: (mode: SuperAdminHostsViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminHostsToolbar({
  filters,
  viewMode,
  hideTableView = false,
  limit,
  onSearchChange,
  onViewModeChange,
  onLimitChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <AdminSearchInput
        value={filters.search}
        onChange={onSearchChange}
        placeholder="Search hosts…"
        ariaLabel="Search hosts"
      />

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

export function SuperAdminHostsResultsMeta({
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
