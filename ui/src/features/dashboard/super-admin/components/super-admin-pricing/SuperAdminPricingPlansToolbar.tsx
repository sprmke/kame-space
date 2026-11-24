import { Filter } from 'lucide-react';

import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import { SuperAdminResultsMeta } from '@/features/dashboard/super-admin/components/shared/SuperAdminResultsMeta';
import type {
  SuperAdminPricingPlansFilters,
  SuperAdminPricingPlansViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminPricingFilters';

import { AdminSearchInput } from '@/components/navigation/AdminSearchInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  filters: SuperAdminPricingPlansFilters;
  viewMode: SuperAdminPricingPlansViewMode;
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: SuperAdminPricingPlansFilters['status']) => void;
  onViewModeChange: (mode: SuperAdminPricingPlansViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminPricingPlansToolbar({
  filters,
  viewMode,
  hideTableView = false,
  limit,
  onSearchChange,
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
          placeholder="Search plans…"
          ariaLabel="Search plans"
        />

        <Select value={filters.status} onValueChange={onStatusChange}>
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

export { SuperAdminResultsMeta as SuperAdminPricingPlansResultsMeta };
