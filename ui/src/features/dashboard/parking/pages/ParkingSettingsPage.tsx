import { useParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { ParkingSettingsCard } from '@/features/dashboard/parking/components/ParkingSettingsCard';
import { useParkingPermissions } from '@/features/dashboard/team/hooks/useParkingPermissions';
import { hasParkingPermission } from '@/features/dashboard/team/lib/parkingPermissions';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { ParkingSettingsRouteSkeleton } from '@/components/skeletons/RouteSkeletons';

export function ParkingSettingsPage() {
  const { parking } = useParkingContext();
  const { data, isLoading, isError } = useParkingPermissions();
  const canEdit = hasParkingPermission(data?.permissions, 'settings:edit');

  if (isLoading && !data) return <ParkingSettingsRouteSkeleton />;

  if (isError || !data) {
    return (
      <AdminMobilePage title="Settings" subtitle={parking.name} titleId="parking-settings-heading">
        <FloatingPanel padding="lg">
          <p className="text-destructive text-sm">Could not load settings.</p>
        </FloatingPanel>
      </AdminMobilePage>
    );
  }

  if (!canEdit) {
    return (
      <AdminMobilePage title="Settings" subtitle={parking.name} titleId="parking-settings-heading">
        <FloatingPanel padding="lg">
          <p className="text-muted-foreground text-sm">
            You can view this page but not change it. Ask the parking owner or manager for settings
            edit access.
          </p>
        </FloatingPanel>
      </AdminMobilePage>
    );
  }

  return <ParkingSettingsCard />;
}
