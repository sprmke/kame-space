import { AdminLayoutOutlet } from '@/features/dashboard/bookings/components/AdminLayout';
import { RequireAdmin } from '@/features/dashboard/bookings/components/RequireAdmin';
import { RequireOrgNotHardRejected } from '@/features/dashboard/org/components/RequireOrgNotHardRejected';
import { RequireParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { ParkingSettingsIssuesSync } from '@/features/dashboard/parking/components/ParkingSettingsIssuesSync';

import { useAdminRouteChunkPrefetch } from '@/hooks/useAdminRouteChunkPrefetch';

/** Auth + parking tenant context + persistent AdminLayout. */
export function ParkingAdminShell() {
  // Outside the guards on purpose: the page chunk must not wait for the guard queries.
  useAdminRouteChunkPrefetch();

  return (
    <RequireAdmin>
      <RequireOrgNotHardRejected>
        <RequireParkingContext>
          <ParkingSettingsIssuesSync />
          <AdminLayoutOutlet />
        </RequireParkingContext>
      </RequireOrgNotHardRejected>
    </RequireAdmin>
  );
}
