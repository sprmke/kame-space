import { Filter } from 'lucide-react';

import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import type { SuperAdminApprovalsFilters } from '@/features/dashboard/super-admin/lib/superAdminApprovalsFilters';
import type { SuperAdminListViewMode } from '@/features/dashboard/super-admin/lib/superAdminListViewMode';

import { AdminSearchInput } from '@/components/navigation/AdminSearchInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TYPE_LABELS: Record<SuperAdminApprovalsFilters['type'], string> = {
  all: 'All types',
  property: 'Property',
  parking: 'Parking',
  listing_verification: 'Listing verification',
  reviews: 'Reviews',
};

const STATUS_OPTIONS: { value: SuperAdminApprovalsFilters['status']; label: string }[] = [
  { value: 'all', label: 'All status' },
  { value: 'pending', label: 'Awaiting review' },
  { value: 'approved', label: 'Approved' },
  { value: 'changes', label: 'Changes requested' },
  { value: 'rejected', label: 'Rejected' },
];

type Props = {
  filters: SuperAdminApprovalsFilters;
  viewMode: SuperAdminListViewMode;
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: SuperAdminApprovalsFilters['type']) => void;
  onStatusChange: (value: SuperAdminApprovalsFilters['status']) => void;
  onViewModeChange: (mode: SuperAdminListViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminApprovalsToolbar({
  filters,
  viewMode,
  hideTableView = false,
  limit,
  onSearchChange,
  onTypeChange,
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
          placeholder="Search approvals…"
          ariaLabel="Search approvals"
        />

        <Select
          value={filters.type}
          onValueChange={(value) => onTypeChange(value as SuperAdminApprovalsFilters['type'])}
        >
          <SelectTrigger
            className="h-10 w-[min(100%,10.5rem)] shrink-0 sm:w-[10.5rem]"
            aria-label="Filter by type"
          >
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => onStatusChange(value as SuperAdminApprovalsFilters['status'])}
        >
          <SelectTrigger
            className="h-10 w-[min(100%,11rem)] shrink-0 sm:w-[11rem]"
            aria-label="Filter by status"
          >
            <Filter className="size-4 shrink-0 opacity-70" aria-hidden />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
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
