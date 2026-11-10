import {
  AlertTriangle,
  Globe,
  Home,
  Image as ImageIcon,
  Info,
  MapPin,
  Save,
  ScrollText,
  Sparkles,
  Zap,
} from 'lucide-react';

import {
  AdminSectionNavLayout,
  type AdminSectionNavItem,
} from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { useParkingSettingsController } from '@/features/dashboard/parking/hooks/useParkingSettingsController';
import {
  ParkingActivitySection,
  ParkingAmenitiesSection,
  ParkingAutomationsSectionBlock,
  ParkingBasicInformationSection,
  ParkingDangerZoneSection,
  ParkingDetailsSectionBlock,
  ParkingIntegrationsSection,
  ParkingLocationSection,
  ParkingPhotosSection,
} from '@/features/dashboard/parking/components/ParkingSettingsSections';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import { AppSettingsNavLayoutSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

const SECTIONS: AdminSectionNavItem[] = [
  { id: 'basic', label: 'Basic Information', icon: Info },
  { id: 'media', label: 'Photos', icon: ImageIcon },
  { id: 'details', label: 'Parking Details', icon: Home },
  { id: 'features', label: 'Amenities', icon: Sparkles },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'integrations', label: 'Integrations', icon: Globe },
  { id: 'activity', label: 'Activity', icon: ScrollText },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

export function ParkingSettingsCard() {
  const controller = useParkingSettingsController();
  const {
    settings,
    settingsLoading,
    isDirty,
    userEdited,
    draftCompletion,
    navSections,
    busy,
    saveDisabledByValidation,
    saveDisabled,
    handleSave,
  } = controller;

  const showSaveActions = isDirty && userEdited;

  useUnsavedChangesGuard({
    isDirty: showSaveActions,
    onSave: () => handleSave(),
  });

  const settingsReady = !settingsLoading && settings;

  return (
    <>
      <AdminMobilePage
        title="Settings"
        subtitle="Manage your parking slot's details, photos, and configurations."
        titleId="parking-settings-heading"
        className="flex min-h-0 flex-1 flex-col"
        heroTrailing={
          showSaveActions ? (
            <MobileHeroActionButton
              aria-label={busy ? 'Saving' : 'Save changes'}
              disabled={saveDisabled}
              title={
                saveDisabledByValidation
                  ? (draftCompletion.firstErrorMessage ?? 'Fix required fields to save')
                  : undefined
              }
              onClick={() => void handleSave()}
            >
              <Save className="size-5" aria-hidden />
            </MobileHeroActionButton>
          ) : undefined
        }
        desktopActions={
          showSaveActions ? (
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saveDisabled}
              title={
                saveDisabledByValidation
                  ? (draftCompletion.firstErrorMessage ?? 'Fix required fields to save')
                  : undefined
              }
              className="min-h-[44px] gap-1.5"
            >
              <Save className="size-4" aria-hidden />
              {busy ? 'Saving...' : 'Save Changes'}
            </Button>
          ) : undefined
        }
      >
        {!settingsReady ? (
          <AppSettingsNavLayoutSkeleton navLabels={SECTIONS.map((section) => section.label)} />
        ) : (
          <AdminSectionNavLayout className="min-h-0 flex-1" sections={navSections}>
            <ParkingBasicInformationSection controller={controller} />
            <ParkingPhotosSection controller={controller} />
            <ParkingDetailsSectionBlock controller={controller} />
            <ParkingAmenitiesSection controller={controller} />
            <ParkingLocationSection controller={controller} />
            <ParkingAutomationsSectionBlock controller={controller} />
            <ParkingIntegrationsSection controller={controller} />
            <ParkingActivitySection />
            <ParkingDangerZoneSection controller={controller} />
          </AdminSectionNavLayout>
        )}
      </AdminMobilePage>
    </>
  );
}
