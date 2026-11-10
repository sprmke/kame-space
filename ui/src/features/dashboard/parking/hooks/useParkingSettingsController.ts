import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import {
  AlertTriangle,
  Globe,
  Home,
  Image as ImageIcon,
  Info,
  MapPin,
  ScrollText,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAdminBrandColorPreview } from '@/features/dashboard/bookings/components/AdminBrandTheme';
import type { AdminSectionNavItem } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { useParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import { orgParkingsPath } from '@/features/dashboard/org/lib/tenantPaths';
import {
  formatParkingCode,
  formatParkingDisplayName,
} from '@/features/dashboard/org/lib/parkingSlotDisplay';
import {
  useParkingSettings,
  useUpdateParkingSettings,
} from '@/features/dashboard/parking/hooks/useParkingSettings';
import { useParkingSettingsCompletionForDraft } from '@/features/dashboard/parking/hooks/useParkingSettingsCompletion';
import {
  useDeleteParking,
  useUpdateParking,
} from '@/features/dashboard/parking/hooks/useUpdateParking';
import {
  mergeParkingAutomationToggles,
  type ParkingAutomationToggles,
} from '@/features/dashboard/parking/lib/parkingEmailAutomation';
import {
  parkingFeaturesDraftFromSettings,
  parkingFeaturesDraftIsDirty,
  parkingFeaturesSettingsPatch,
} from '@/features/dashboard/parking/lib/parkingFeaturesConstants';
import { type ParkingSettingsSectionId } from '@/features/dashboard/parking/lib/parkingSettingsCompletion';
import { resolveParkingSettingsFieldError } from '@/features/dashboard/parking/lib/parkingSettingsFieldError';
import {
  parkingCoverImageFromSettings,
  parkingDetailsDraftFromSettings,
  parkingDetailsDraftIsDirty,
  parkingDetailsSettingsPatch,
  parkingLocationDraftFromSettings,
  parkingLocationDraftIsDirty,
  parkingLocationSettingsPatch,
  parkingProfileDraftFromParking,
  parkingProfileDraftIsDirty,
  parkingProfileSettingsPatch,
  type ParkingProfileDraft,
} from '@/features/dashboard/parking/lib/parkingSettingsForm';
import { setParkingSettingsIssueSections } from '@/features/dashboard/parking/lib/parkingSettingsIssuesStore';
import { planParkingSettingsSave } from '@/features/dashboard/parking/lib/parkingSettingsSavePlan';

import { useSettingsUserEdited } from '@/hooks/useSettingsUserEdited';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

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

export function useParkingSettingsController() {
  const navigate = useNavigate();
  const { parking, orgSlug } = useParkingContext();
  const inheritedBrandColor = useOrgBrandColor();
  const { setBrandColorPreview } = useAdminBrandColorPreview();
  const { data: settings, isLoading: settingsLoading } = useParkingSettings();
  const updateParking = useUpdateParking(orgSlug);
  const deleteParking = useDeleteParking(orgSlug);
  const updateSettings = useUpdateParkingSettings();

  const [profileBaseline, setProfileBaseline] = useState(() =>
    parkingProfileDraftFromParking(parking, inheritedBrandColor)
  );
  const [profileDraft, setProfileDraft] = useState(profileBaseline);
  const [coverImage, setCoverImage] = useState(() =>
    parkingCoverImageFromSettings(parking.settings)
  );
  const [featuresBaseline, setFeaturesBaseline] = useState(() =>
    parkingFeaturesDraftFromSettings(parking.settings)
  );
  const [featuresDraft, setFeaturesDraft] = useState(featuresBaseline);
  const [newCustomFeatureInput, setNewCustomFeatureInput] = useState('');
  const [locationBaseline, setLocationBaseline] = useState(() =>
    parkingLocationDraftFromSettings(parking.settings, parking.residenceName)
  );
  const [locationDraft, setLocationDraft] = useState(locationBaseline);
  const [detailsBaseline, setDetailsBaseline] = useState(() =>
    parkingDetailsDraftFromSettings(parking.settings, parking.acceptedVehicleTypes)
  );
  const [detailsDraft, setDetailsDraft] = useState(detailsBaseline);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [automationBaseline, setAutomationBaseline] = useState<ParkingAutomationToggles>(() =>
    mergeParkingAutomationToggles(parking.settings?.automationToggles)
  );
  const [automationDraft, setAutomationDraft] = useState(automationBaseline);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [interactedFields, setInteractedFields] = useState<Record<string, boolean>>({});

  const { userEdited, markUserEdited, resetUserEdited } = useSettingsUserEdited();

  const markFieldInteracted = useCallback(
    (fieldId: string) => {
      markUserEdited();
      setInteractedFields((current) => {
        if (current[fieldId]) return current;
        return { ...current, [fieldId]: true };
      });
    },
    [markUserEdited]
  );

  const profileDirtyRef = useRef(false);
  const automationDirtyRef = useRef(false);
  const featuresDirtyRef = useRef(false);
  const locationDirtyRef = useRef(false);
  const detailsDirtyRef = useRef(false);

  const displayName = useMemo(
    () => formatParkingDisplayName(profileDraft.tower, profileDraft.level, profileDraft.slotNumber),
    [profileDraft.tower, profileDraft.level, profileDraft.slotNumber]
  );
  const parkingCode = useMemo(
    () => formatParkingCode(profileDraft.tower, profileDraft.level, profileDraft.slotNumber),
    [profileDraft.tower, profileDraft.level, profileDraft.slotNumber]
  );

  const parkingSlugPrefix =
    typeof window !== 'undefined' ? `${window.location.origin}/parkings/` : '/parkings/';

  useEffect(() => {
    return () => setBrandColorPreview(null);
  }, [setBrandColorPreview]);

  useEffect(() => {
    if (profileDirtyRef.current) return;
    const next = parkingProfileDraftFromParking(parking, inheritedBrandColor);
    setProfileDraft(next);
    setProfileBaseline(next);
    const nextCover = parkingCoverImageFromSettings(parking.settings);
    setCoverImage(nextCover);
  }, [
    parking.id,
    parking.updatedAt,
    parking.settings,
    parking.tower,
    parking.level,
    parking.slotLabel,
    parking.parkingType,
    parking.residenceName,
    inheritedBrandColor,
  ]);

  useEffect(() => {
    if (featuresDirtyRef.current) return;
    const next = parkingFeaturesDraftFromSettings(parking.settings);
    setFeaturesDraft(next);
    setFeaturesBaseline(next);
  }, [parking.id, parking.updatedAt, parking.settings]);

  useEffect(() => {
    if (locationDirtyRef.current) return;
    const next = parkingLocationDraftFromSettings(parking.settings, parking.residenceName);
    setLocationDraft(next);
    setLocationBaseline(next);
  }, [parking.id, parking.updatedAt, parking.settings, parking.residenceName]);

  useEffect(() => {
    if (detailsDirtyRef.current) return;
    const next = parkingDetailsDraftFromSettings(parking.settings, parking.acceptedVehicleTypes);
    setDetailsDraft(next);
    setDetailsBaseline(next);
  }, [parking.id, parking.updatedAt, parking.settings, parking.acceptedVehicleTypes]);

  useEffect(() => {
    if (!settings) return;
    if (automationDirtyRef.current) return;
    const nextAutomation = mergeParkingAutomationToggles(settings.automationToggles);
    setAutomationDraft(nextAutomation);
    setAutomationBaseline(nextAutomation);
  }, [settings]);

  const profileDirty = parkingProfileDraftIsDirty(
    profileDraft,
    profileBaseline,
    inheritedBrandColor
  );
  profileDirtyRef.current = profileDirty;
  const automationDirty = JSON.stringify(automationDraft) !== JSON.stringify(automationBaseline);
  automationDirtyRef.current = automationDirty;
  const featuresDirty = parkingFeaturesDraftIsDirty(featuresDraft, featuresBaseline);
  featuresDirtyRef.current = featuresDirty;
  const locationDirty = parkingLocationDraftIsDirty(locationDraft, locationBaseline);
  locationDirtyRef.current = locationDirty;
  const detailsDirty = parkingDetailsDraftIsDirty(detailsDraft, detailsBaseline);
  detailsDirtyRef.current = detailsDirty;
  const isDirty = profileDirty || automationDirty || featuresDirty || locationDirty || detailsDirty;

  const isArchived = parking.status === 'INACTIVE';

  const { completion: draftCompletion } = useParkingSettingsCompletionForDraft({
    profile: profileDraft,
    details: detailsDraft,
    features: featuresDraft,
    location: locationDraft,
    coverImage,
    excludeParkingId: parking.id,
  });

  const { completion: savedCompletion } = useParkingSettingsCompletionForDraft({
    profile: profileBaseline,
    details: detailsBaseline,
    features: featuresBaseline,
    location: locationBaseline,
    coverImage,
    excludeParkingId: parking.id,
  });

  const resolveFieldError = useCallback(
    (fieldId: string) =>
      resolveParkingSettingsFieldError(
        fieldId,
        draftCompletion.fieldErrors,
        interactedFields,
        showValidationErrors
      ),
    [draftCompletion.fieldErrors, interactedFields, showValidationErrors]
  );

  const navSections = useMemo(
    (): AdminSectionNavItem[] =>
      SECTIONS.map((section) => ({
        ...section,
        hasIssue: draftCompletion.issueSectionIds.includes(section.id as ParkingSettingsSectionId),
      })),
    [draftCompletion.issueSectionIds]
  );

  useEffect(() => {
    setParkingSettingsIssueSections(draftCompletion.issueSectionIds);
    return () => {
      setParkingSettingsIssueSections(savedCompletion.issueSectionIds);
    };
  }, [draftCompletion.issueSectionIds, savedCompletion.issueSectionIds]);

  const scrollToSettingsSection = (sectionId: ParkingSettingsSectionId) => {
    document
      .getElementById(`section-${sectionId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const busy =
    settingsLoading ||
    updateParking.isPending ||
    updateSettings.isPending ||
    deleteParking.isPending;
  const fullPageSavePlan = planParkingSettingsSave({
    dirty: {
      profile: profileDirty,
      details: detailsDirty,
      features: featuresDirty,
      location: locationDirty,
      automation: automationDirty,
    },
    completion: draftCompletion,
  });
  const saveDisabledByValidation = isDirty && !fullPageSavePlan.hasSavableWork;
  const saveDisabled = busy || saveDisabledByValidation;

  useEffect(() => {
    if (saveDisabledByValidation) {
      setShowValidationErrors(true);
    }
  }, [saveDisabledByValidation]);

  const setProfileField = <K extends keyof ParkingProfileDraft>(
    key: K,
    value: ParkingProfileDraft[K]
  ) => {
    markUserEdited();
    setProfileDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async (options?: {
    scopeSectionIds?: readonly ParkingSettingsSectionId[] | null;
  }): Promise<boolean> => {
    if (!isDirty) {
      toast.message('No changes to save');
      return false;
    }

    const plan = planParkingSettingsSave({
      dirty: {
        profile: profileDirty,
        details: detailsDirty,
        features: featuresDirty,
        location: locationDirty,
        automation: automationDirty,
      },
      completion: draftCompletion,
      scopeSectionIds: options?.scopeSectionIds,
    });

    if (!plan.hasSavableWork) {
      setShowValidationErrors(true);
      toast.error(
        plan.firstBlockedMessage ??
          draftCompletion.firstErrorMessage ??
          'Please fix the highlighted fields'
      );
      if (plan.firstBlockedSectionId) {
        scrollToSettingsSection(plan.firstBlockedSectionId);
      } else if (draftCompletion.firstIssueSectionId) {
        scrollToSettingsSection(draftCompletion.firstIssueSectionId);
      }
      return false;
    }

    setShowValidationErrors(false);

    try {
      let savedSomething = false;

      if (plan.saveProfile) {
        const settingsPatch = parkingProfileSettingsPatch(profileDraft, inheritedBrandColor);
        await updateParking.mutateAsync({
          parkingId: parking.id,
          settings: settingsPatch,
        });
        setProfileBaseline(profileDraft);
        savedSomething = true;
      }

      if (plan.saveAutomation) {
        await updateSettings.mutateAsync({
          automationToggles: automationDraft,
        });
        setAutomationBaseline(automationDraft);
        savedSomething = true;
      }

      if (plan.saveFeatures || plan.saveLocation || plan.saveDetails) {
        await updateParking.mutateAsync({
          parkingId: parking.id,
          settings: {
            ...(plan.saveFeatures ? parkingFeaturesSettingsPatch(featuresDraft) : {}),
            ...(plan.saveLocation ? parkingLocationSettingsPatch(locationDraft) : {}),
            ...(plan.saveDetails ? parkingDetailsSettingsPatch(detailsDraft) : {}),
          },
          ...(plan.saveDetails ? { acceptedVehicleTypes: detailsDraft.acceptedVehicleTypes } : {}),
        });
        if (plan.saveFeatures) setFeaturesBaseline(featuresDraft);
        if (plan.saveLocation) setLocationBaseline(locationDraft);
        if (plan.saveDetails) setDetailsBaseline(detailsDraft);
        savedSomething = true;
      }

      if (savedSomething) {
        setInteractedFields({});
        resetUserEdited();
        toast.success('Settings saved');
        return true;
      }
      return false;
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not save settings'));
      return false;
    }
  };

  const handleDelete = async () => {
    try {
      await deleteParking.mutateAsync(parking.id);
      toast.success('Parking deleted');
      navigate(orgParkingsPath(orgSlug));
    } catch (error) {
      toast.error(friendlyToastError(error, 'Delete failed'));
    }
  };

  const handleArchive = async () => {
    try {
      await updateParking.mutateAsync({ parkingId: parking.id, status: 'INACTIVE' });
      toast.success('Parking archived');
      setArchiveOpen(false);
    } catch (error) {
      toast.error(friendlyToastError(error, 'Archive failed'));
    }
  };

  const handleRestore = async () => {
    try {
      await updateParking.mutateAsync({ parkingId: parking.id, status: 'ACTIVE' });
      toast.success('Parking restored');
      setRestoreOpen(false);
    } catch (error) {
      toast.error(friendlyToastError(error, 'Restore failed'));
    }
  };

  const setAutomationToggle = (key: keyof ParkingAutomationToggles, enabled: boolean) => {
    markUserEdited();
    setAutomationDraft((current) => ({ ...current, [key]: enabled }));
  };

  const setDetailsDraftTracked: typeof setDetailsDraft = (value) => {
    markUserEdited();
    setDetailsDraft(value);
  };

  const setFeaturesDraftTracked: typeof setFeaturesDraft = (value) => {
    markUserEdited();
    setFeaturesDraft(value);
  };

  const setLocationDraftTracked: typeof setLocationDraft = (value) => {
    markUserEdited();
    setLocationDraft(value);
  };

  return {
    navigate,
    parking,
    orgSlug,
    inheritedBrandColor,
    setBrandColorPreview,
    settings,
    settingsLoading,
    updateParking,
    deleteParking,
    updateSettings,
    profileBaseline,
    setProfileBaseline,
    profileDraft,
    setProfileDraft,
    coverImage,
    setCoverImage,
    featuresBaseline,
    setFeaturesBaseline,
    featuresDraft,
    setFeaturesDraft: setFeaturesDraftTracked,
    newCustomFeatureInput,
    setNewCustomFeatureInput,
    locationBaseline,
    setLocationBaseline,
    locationDraft,
    setLocationDraft: setLocationDraftTracked,
    detailsBaseline,
    setDetailsBaseline,
    detailsDraft,
    setDetailsDraft: setDetailsDraftTracked,
    deleteOpen,
    setDeleteOpen,
    archiveOpen,
    setArchiveOpen,
    restoreOpen,
    setRestoreOpen,
    automationBaseline,
    setAutomationBaseline,
    automationDraft,
    setAutomationDraft,
    showValidationErrors,
    setShowValidationErrors,
    interactedFields,
    setInteractedFields,
    markFieldInteracted,
    profileDirtyRef,
    automationDirtyRef,
    featuresDirtyRef,
    locationDirtyRef,
    detailsDirtyRef,
    displayName,
    parkingCode,
    parkingSlugPrefix,
    profileDirty,
    automationDirty,
    featuresDirty,
    locationDirty,
    detailsDirty,
    isDirty,
    userEdited,
    isArchived,
    draftCompletion,
    savedCompletion,
    resolveFieldError,
    navSections,
    scrollToSettingsSection,
    busy,
    saveDisabledByValidation,
    saveDisabled,
    setProfileField,
    handleSave,
    handleDelete,
    handleArchive,
    handleRestore,
    setAutomationToggle,
  };
}
