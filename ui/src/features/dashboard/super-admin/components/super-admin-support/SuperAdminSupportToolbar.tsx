import { Filter } from 'lucide-react';

import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SUPPORT_TICKET_CATEGORY_LABELS } from '@/features/dashboard/help-support/lib/supportTicketSchema';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import {
  SUPPORT_TICKET_STATUS_LABELS,
  type SuperAdminSupportFilters,
  type SuperAdminSupportViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminSupportFilters';

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
  filters: SuperAdminSupportFilters;
  viewMode: SuperAdminSupportViewMode;
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: SuperAdminSupportFilters['category']) => void;
  onStatusChange: (value: SuperAdminSupportFilters['status']) => void;
  onViewModeChange: (mode: SuperAdminSupportViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminSupportToolbar({
  filters,
  viewMode,
  hideTableView = false,
  limit,
  onSearchChange,
  onCategoryChange,
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
          placeholder="Search tickets…"
          ariaLabel="Search tickets"
        />

        <Select
          value={filters.category}
          onValueChange={(value) => onCategoryChange(value as SuperAdminSupportFilters['category'])}
        >
          <SelectTrigger
            className="h-10 w-[min(100%,10.5rem)] shrink-0 sm:w-[10.5rem]"
            aria-label="Filter by category"
          >
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(SUPPORT_TICKET_CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => onStatusChange(value as SuperAdminSupportFilters['status'])}
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
            {Object.entries(SUPPORT_TICKET_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
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

export function SuperAdminSupportResultsMeta({
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
