import { AlertTriangle, Globe, Image as ImageIcon, Info, MapPin, ScrollText } from 'lucide-react';

import { ActivitySettingsSection } from '@/features/dashboard/activity/components/ActivitySettingsSection';
import { PropertyIntegrationsPanel } from '@/features/dashboard/bookings/components/PropertyIntegrationsPanel';
import { PropertyLocationPicker } from '@/features/dashboard/org/components/property-settings/PropertyLocationPicker';
import {
  PropertySettingsSectionAlert,
  SettingsField,
} from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { BrandColorField } from '@/features/dashboard/org/components/settings/BrandColorField';
import { DEFAULT_PARKING_RESIDENCE_NAME } from '@/features/dashboard/org/lib/parkingResidences';
import { parkingNotificationsPath } from '@/features/dashboard/org/lib/tenantPaths';
import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { ParkingAutomationsSection } from '@/features/dashboard/parking/components/ParkingAutomationsSection';
import { ParkingDetailsSection } from '@/features/dashboard/parking/components/ParkingDetailsSection';
import { ParkingFeaturesSection } from '@/features/dashboard/parking/components/ParkingFeaturesSection';
import { ParkingMediaUpload } from '@/features/dashboard/parking/components/ParkingMediaUpload';
import type { useParkingSettingsController } from '@/features/dashboard/parking/hooks/useParkingSettingsController';
import { parkingSettingsSectionBanner } from '@/features/dashboard/parking/lib/parkingSettingsFieldError';
import { PARKING_DESCRIPTION_MAX } from '@/features/dashboard/parking/lib/parkingSettingsForm';
import { PARKING_TYPES } from '@/features/dashboard/org/lib/parkingResidences';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type SettingsController = ReturnType<typeof useParkingSettingsController>;

const readOnlyFieldClass = 'bg-muted/40';

function parkingTypeLabel(value: string): string {
  return PARKING_TYPES.find((type) => type.value === value)?.label ?? value;
}

export function ParkingBasicInformationSection({
  controller,
}: {
  controller: SettingsController;
}) {
  const {
    parking,
    inheritedBrandColor,
    setBrandColorPreview,
    profileDraft,
    parkingCode,
    parkingSlugPrefix,
    busy,
    resolveFieldError,
    setProfileField,
  } = controller;

  return (
    <AdminSection
      id="basic"
      title="Basic Information"
      icon={Info}
      description="Brand color, description, and slot identity."
    >
      <SettingsField id="parking-code" label="Code">
        <Input
          id="parking-code"
          value={parkingCode}
          readOnly
          aria-readonly="true"
          placeholder="-"
          className="bg-muted/40 text-muted-foreground h-10 cursor-default font-mono tabular-nums"
        />
      </SettingsField>

      <SettingsField id="parking-slug" label="URL Slug">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-muted-foreground truncate text-sm">{parkingSlugPrefix}</span>
          <Input
            id="parking-slug"
            value={parking.slug}
            readOnly
            disabled={busy}
            placeholder="parking-slug"
            className="bg-muted/40 max-w-xs"
            autoComplete="off"
            spellCheck={false}
            aria-readonly="true"
          />
        </div>
      </SettingsField>

      <BrandColorField
        id="parking-brand-color"
        value={profileDraft.brandColor}
        resolvedColor={inheritedBrandColor}
        resetValue={inheritedBrandColor}
        disabled={busy}
        help="Tints this parking slot's admin pages, guest listing, and accents."
        onChange={(value) => {
          setProfileField('brandColor', value);
          setBrandColorPreview(value.trim() || inheritedBrandColor);
        }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
        <SettingsField
          id="settings-parking-type"
          label="Parking type"
          required
          error={resolveFieldError('settings-parking-type')}
          help="Set at creation and can't be changed."
        >
          <Input
            id="settings-parking-type"
            value={parkingTypeLabel(profileDraft.parkingType)}
            readOnly
            disabled={busy}
            tabIndex={-1}
            aria-readonly="true"
            className={readOnlyFieldClass}
          />
        </SettingsField>

        <SettingsField
          id="settings-residence"
          label="Residence"
          required
          error={resolveFieldError('settings-residence')}
          help="Set at creation and can't be changed."
        >
          <Input
            id="settings-residence"
            value={profileDraft.residenceName.trim() || DEFAULT_PARKING_RESIDENCE_NAME}
            readOnly
            disabled={busy}
            tabIndex={-1}
            aria-readonly="true"
            className={readOnlyFieldClass}
          />
        </SettingsField>

        <SettingsField
          id="settings-tower"
          label="Tower"
          required
          error={resolveFieldError('settings-tower')}
          help="Set at creation and can't be changed."
        >
          <Input
            id="settings-tower"
            value={profileDraft.tower}
            readOnly
            disabled={busy}
            tabIndex={-1}
            aria-readonly="true"
            className={readOnlyFieldClass}
          />
        </SettingsField>

        <SettingsField
          id="settings-level"
          label="Level"
          required
          error={resolveFieldError('settings-level')}
          help="Set at creation and can't be changed."
        >
          <Input
            id="settings-level"
            value={profileDraft.level}
            readOnly
            disabled={busy}
            tabIndex={-1}
            aria-readonly="true"
            className={readOnlyFieldClass}
          />
        </SettingsField>
      </div>

      <SettingsField
        id="settings-slot"
        label="Slot number"
        required
        error={resolveFieldError('settings-slot')}
        help="Set at creation and can't be changed."
      >
        <Input
          id="settings-slot"
          value={profileDraft.slotNumber}
          readOnly
          disabled={busy}
          tabIndex={-1}
          aria-readonly="true"
          className={cn(readOnlyFieldClass, 'tabular-nums')}
        />
      </SettingsField>

      <SettingsField id="parking-description" label="Description">
        <Textarea
          id="parking-description"
          value={profileDraft.description}
          onChange={(event) => setProfileField('description', event.target.value)}
          disabled={busy}
          rows={6}
          maxLength={PARKING_DESCRIPTION_MAX}
          className="min-h-[140px] resize-y"
        />
        <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
          {profileDraft.description.length}/{PARKING_DESCRIPTION_MAX} characters
        </p>
      </SettingsField>
    </AdminSection>
  );
}

export function ParkingPhotosSection({ controller }: { controller: SettingsController }) {
  const { coverImage, setCoverImage, busy, draftCompletion } = controller;
  const banner = parkingSettingsSectionBanner('media', draftCompletion.sectionMessages);

  return (
    <AdminSection
      id="media"
      title="Photos"
      icon={ImageIcon}
      description="Cover photo for the public listing."
    >
      {banner ? <PropertySettingsSectionAlert message={banner} /> : null}
      <ParkingMediaUpload coverImage={coverImage} onCoverChange={setCoverImage} disabled={busy} />
    </AdminSection>
  );
}

export function ParkingDetailsSectionBlock({ controller }: { controller: SettingsController }) {
  return (
    <ParkingDetailsSection
      draft={controller.detailsDraft}
      onChange={controller.setDetailsDraft}
      disabled={controller.busy}
      resolveFieldError={controller.resolveFieldError}
      markFieldInteracted={controller.markFieldInteracted}
    />
  );
}

export function ParkingAmenitiesSection({ controller }: { controller: SettingsController }) {
  return (
    <ParkingFeaturesSection
      draft={controller.featuresDraft}
      onChange={controller.setFeaturesDraft}
      disabled={controller.busy}
      newCustomInput={controller.newCustomFeatureInput}
      onNewCustomInputChange={controller.setNewCustomFeatureInput}
      banner={parkingSettingsSectionBanner(
        'features',
        controller.draftCompletion.sectionMessages
      )}
    />
  );
}

export function ParkingLocationSection({ controller }: { controller: SettingsController }) {
  return (
    <AdminSection
      id="location"
      title="Location"
      icon={MapPin}
      description="Address and map pin."
    >
      <PropertyLocationPicker
        disabled={controller.busy}
        value={controller.locationDraft}
        onChange={(patch) =>
          controller.setLocationDraft((current) => ({ ...current, ...patch }))
        }
        addressError={controller.resolveFieldError('property-address')}
        mapError={controller.resolveFieldError('property-location-map')}
        onFieldInteract={controller.markFieldInteracted}
      />
    </AdminSection>
  );
}

export function ParkingAutomationsSectionBlock({
  controller,
}: {
  controller: SettingsController;
}) {
  return (
    <ParkingAutomationsSection
      value={controller.automationDraft}
      disabled={controller.busy}
      onChange={controller.setAutomationToggle}
    />
  );
}

export function ParkingIntegrationsSection({ controller }: { controller: SettingsController }) {
  const { settings, orgSlug, parking } = controller;
  if (!settings) return null;

  return (
    <AdminSection
      id="integrations"
      title="Integrations"
      icon={Globe}
      description="Telegram and AI service status."
    >
      {settings.parkingIntegrations ? (
        <PropertyIntegrationsPanel
          status={settings.parkingIntegrations}
          aiKeys={{
            primaryKeysConfigured: settings.platformSecrets?.geminiApiKeyConfigured ?? false,
            fallbackKeyConfigured: settings.platformSecrets?.groqApiKeyConfigured ?? false,
          }}
          telegramLayout="parking"
          notificationsPath={(module) =>
            parkingNotificationsPath(
              orgSlug,
              parking.slug,
              module === 'finance' ? 'finance' : undefined
            )
          }
        />
      ) : null}
    </AdminSection>
  );
}

export function ParkingActivitySection() {
  return (
    <AdminSection id="activity" title="Activity" icon={ScrollText}>
      <ActivitySettingsSection scope="parking" />
    </AdminSection>
  );
}

export function ParkingDangerZoneSection({ controller }: { controller: SettingsController }) {
  const {
    parking,
    displayName,
    isArchived,
    busy,
    updateParking,
    deleteParking,
    archiveOpen,
    setArchiveOpen,
    restoreOpen,
    setRestoreOpen,
    deleteOpen,
    setDeleteOpen,
    handleArchive,
    handleRestore,
    handleDelete,
  } = controller;

  return (
    <AdminSection
      id="danger"
      title="Danger Zone"
      icon={AlertTriangle}
      description="Archive or permanently delete this slot."
      className="border-destructive/50"
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold sm:text-sm">
              {isArchived ? 'Restore parking' : 'Archive parking'}
            </p>
            <p className="text-card-description">
              {isArchived
                ? 'Sets status to Active. Shows this slot on the public listing again.'
                : 'Sets status to Inactive. Hides this slot from the public listing. Bookings and settings are kept.'}
            </p>
          </div>
          {isArchived ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || updateParking.isPending}
              className="settings-action w-full sm:w-auto"
              onClick={() => setRestoreOpen(true)}
            >
              {updateParking.isPending ? 'Restoring…' : 'Restore'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || updateParking.isPending}
              className="settings-action w-full sm:w-auto"
              onClick={() => setArchiveOpen(true)}
            >
              {updateParking.isPending ? 'Archiving…' : 'Archive'}
            </Button>
          )}
        </div>

        <div className="border-destructive/50 flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="space-y-0.5">
            <p className="text-destructive text-xs font-semibold sm:text-sm">Delete parking</p>
            <p className="text-card-description">
              Permanently removes this parking slot and its settings. This cannot be undone.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy || deleteParking.isPending}
            className="settings-action w-full sm:w-auto"
            onClick={() => setDeleteOpen(true)}
          >
            {deleteParking.isPending ? 'Deleting…' : 'Delete parking'}
          </Button>
        </div>
      </div>

      <ResponsiveModal open={archiveOpen} onOpenChange={setArchiveOpen}>
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),28rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Archive {displayName || parking.name}?</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              This parking slot will be marked Inactive and hidden from the public listing. You can
              restore it anytime from this section.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={updateParking.isPending}
              onClick={() => setArchiveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={updateParking.isPending}
              onClick={() => void handleArchive()}
            >
              {updateParking.isPending ? 'Archiving…' : 'Archive parking'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal open={restoreOpen} onOpenChange={setRestoreOpen}>
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),28rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Restore {displayName || parking.name}?</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              This parking slot will be marked Active and appear on the public listing again.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={updateParking.isPending}
              onClick={() => setRestoreOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={updateParking.isPending}
              onClick={() => void handleRestore()}
            >
              {updateParking.isPending ? 'Restoring…' : 'Restore parking'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal open={deleteOpen} onOpenChange={setDeleteOpen}>
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),28rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Delete {displayName || parking.name}?</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              This parking slot and its settings will be permanently removed. This cannot be undone.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={deleteParking.isPending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={deleteParking.isPending}
              onClick={() => void handleDelete()}
            >
              {deleteParking.isPending ? 'Deleting…' : 'Delete parking'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </AdminSection>
  );
}
