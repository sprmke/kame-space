import { useEffect, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { AlertCircle, Car, Home, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { TowerUnitConflictAlert } from '@/features/dashboard/org/components/TowerUnitConflictAlert';
import { useCheckPropertyName } from '@/features/dashboard/org/hooks/useCheckPropertyName';
import { useCreateParking } from '@/features/dashboard/org/hooks/useCreateParking';
import { useCreateProperty } from '@/features/dashboard/org/hooks/useCreateProperty';
import { useParkingSlotConflict } from '@/features/dashboard/org/hooks/useParkingSlotConflict';
import {
  toResidenceProfile,
  useResidenceOptions,
} from '@/features/dashboard/org/hooks/useResidenceOptions';
import { useTowerUnitConflict } from '@/features/dashboard/org/hooks/useTowerUnitConflict';
import { orgPlansPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { Parking, Property } from '@/features/dashboard/org/types';
import { useOrgPlan } from '@/features/dashboard/plans/hooks/useOrgPlan';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { AvailabilityCheckInput } from '@/components/AvailabilityCheckInput';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { useRunUnguarded } from '@/hooks/useUnsavedChangesGuard';
import {
  resolveAsyncAvailabilityState,
  resolveNameAvailabilityState,
} from '@/lib/availabilityCheckState';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import {
  activeParkingTowers,
  activePropertyTowers,
  formatParkingCodeForProfile,
  formatParkingLocation,
  formatUnitLabel,
  parkingLevelsForTower,
  parkingSlotError,
  parkingTypeForTower,
  sanitizeSlotLabel,
  unitNumberError,
  validateTowerForProfile,
} from '@/lib/residence/residenceProfile';
import { cn } from '@/lib/utils';

type AssetKind = 'property' | 'parking';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  orgName: string;
  canAddProperty?: boolean;
  canAddParking?: boolean;
  defaultKind?: AssetKind;
  onPropertyCreated?: (property: Property) => void;
  onParkingCreated?: (parking: Parking) => void;
};

function KindToggle({
  kind,
  onKindChange,
}: {
  kind: AssetKind;
  onKindChange: (kind: AssetKind) => void;
}) {
  return (
    <SegmentedControl
      value={kind}
      onChange={onKindChange}
      size="dense"
      fullWidth
      triggerClassName="gap-2 px-3"
      aria-label="Asset type"
      options={[
        { value: 'property', label: 'Property', icon: Home },
        { value: 'parking', label: 'Parking', icon: Car },
      ]}
    />
  );
}

function DevelopmentField({
  id,
  value,
  options,
  loading,
  onChange,
}: {
  id: string;
  value: string;
  options: string[];
  loading?: boolean;
  onChange: (name: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Development</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10">
          <SelectValue placeholder="Select development" />
        </SelectTrigger>
        <SelectContent position="popper">
          {loading ? (
            <div className="text-muted-foreground px-3 py-2 text-sm">Loading residences</div>
          ) : null}
          {options.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AddEntityDialog({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  orgName,
  canAddProperty = true,
  canAddParking = true,
  defaultKind = 'property',
  onPropertyCreated,
  onParkingCreated,
}: Props) {
  const navigate = useNavigate();
  const runUnguarded = useRunUnguarded();
  const createProperty = useCreateProperty();
  const createParking = useCreateParking();
  const { data: orgPlan } = useOrgPlan(orgId);

  const showKindToggle = canAddProperty && canAddParking;
  const [kind, setKind] = useState<AssetKind>(defaultKind);

  const [developmentName, setDevelopmentName] = useState('');
  const [parkingTower, setParkingTower] = useState('');
  const [level, setLevel] = useState('');
  const [slotNumber, setSlotNumber] = useState('');

  const { data: residenceOptionsData, isLoading: residenceOptionsLoading } = useResidenceOptions({
    enabled: open,
  });
  const residenceOptions = useMemo(
    () => residenceOptionsData?.residences ?? [],
    [residenceOptionsData]
  );
  const selectedResidence = useMemo(
    () => residenceOptions.find((option) => option.name === developmentName) ?? null,
    [residenceOptions, developmentName]
  );
  const residenceProfile = useMemo(
    () => (selectedResidence ? toResidenceProfile(selectedResidence) : null),
    [selectedResidence]
  );

  const [tower, setTower] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [unitTouched, setUnitTouched] = useState(false);
  const [propertyDisplayName, setPropertyDisplayName] = useState('');

  const propertyTowerOptions = useMemo(
    () =>
      residenceProfile
        ? activePropertyTowers(residenceProfile).map((entry) => entry.name)
        : [],
    [residenceProfile]
  );
  const towerResult = residenceProfile
    ? validateTowerForProfile(residenceProfile, tower)
    : { ok: false as const, error: 'Select a residence first' };
  const unitMessage = residenceProfile
    ? unitNumberError(residenceProfile, unitNumber)
    : 'Unit number is required';
  const unitInvalid = unitTouched && unitNumber.trim().length > 0 && Boolean(unitMessage);
  const unitFormat = residenceProfile?.structure.unitNumberFormat;
  const unitInputMode = unitFormat?.preset === 'digits' || unitFormat?.preset === 'digits4'
    ? 'numeric'
    : 'text';
  const unitMaxLength =
    unitFormat?.preset === 'digits4' ? 4 : unitFormat?.preset === 'digits' ? 6 : 15;

  const {
    conflict,
    hasActiveListing: propertyListed,
    isChecking: towerUnitChecking,
  } = useTowerUnitConflict(tower, unitNumber, undefined, {
    developmentId: selectedResidence?.developmentId ?? null,
    residenceName: selectedResidence?.name ?? null,
    profile: residenceProfile,
  });

  const towerUnitReady =
    Boolean(residenceProfile) &&
    towerResult.ok &&
    unitNumber.trim().length > 0 &&
    !unitMessage;
  const resolvedPropertyName =
    propertyDisplayName.trim() ||
    (towerUnitReady && residenceProfile ? formatUnitLabel(residenceProfile, tower, unitNumber) : '');
  const propertyNameReady = towerUnitReady && resolvedPropertyName.trim().length >= 2;
  const propertyNameCheck = useCheckPropertyName(
    resolvedPropertyName,
    undefined,
    propertyNameReady
  );
  const propertyNameBlocked = propertyNameReady && propertyNameCheck.isUnavailable;
  const propertyNameBlockMessage = propertyNameBlocked
    ? (propertyNameCheck.data?.message ?? 'A property with this name already exists.')
    : null;
  const propertyNameAvailabilityState = resolveNameAvailabilityState({
    ready: propertyNameReady,
    showChecking: propertyNameCheck.showChecking,
    isUnavailable: propertyNameCheck.isUnavailable,
    isFetched: propertyNameCheck.isFetched,
  });
  const unitAvailabilityState = resolveAsyncAvailabilityState({
    ready: towerUnitReady,
    isChecking: towerUnitChecking,
    hasConflict: propertyListed,
  });
  const propertyCanSubmit = towerUnitReady && !propertyNameBlocked;

  const parkingTowerOptions = useMemo(
    () =>
      residenceProfile
        ? activeParkingTowers(residenceProfile).map((entry) => entry.name)
        : [],
    [residenceProfile]
  );
  const parkingLevelOptions = residenceProfile
    ? parkingLevelsForTower(residenceProfile, parkingTower)
    : [];
  const parkingDisplayName =
    residenceProfile && parkingTower && level
      ? formatParkingLocation(residenceProfile, parkingTower, level, slotNumber)
      : '';
  const parkingCode =
    residenceProfile && parkingTower && level
      ? formatParkingCodeForProfile(residenceProfile, parkingTower, level, slotNumber)
      : '';
  const slotMessage = residenceProfile
    ? parkingSlotError(residenceProfile, slotNumber)
    : 'Slot number is required';
  const { hasDuplicate: parkingDuplicate, isChecking: parkingSlotChecking } =
    useParkingSlotConflict(parkingTower, level, slotNumber, selectedResidence?.name ?? '');
  const parkingSlotReady =
    Boolean(residenceProfile) &&
    Boolean(parkingTower) &&
    Boolean(level) &&
    slotNumber.trim().length > 0 &&
    !slotMessage;
  const parkingSlotAvailabilityState = resolveAsyncAvailabilityState({
    ready: parkingSlotReady,
    isChecking: parkingSlotChecking,
    hasConflict: parkingDuplicate,
  });
  const parkingCanSubmit = parkingSlotReady && !parkingDuplicate;


  const [error, setError] = useState<string | null>(null);
  const isPending = createProperty.isPending || createParking.isPending;
  const activeKind: AssetKind = showKindToggle ? kind : canAddProperty ? 'property' : 'parking';
  const canSubmit = activeKind === 'property' ? propertyCanSubmit : parkingCanSubmit;

  useEffect(() => {
    if (!open) return;

    const resolvedKind: AssetKind =
      canAddProperty && !canAddParking
        ? 'property'
        : !canAddProperty && canAddParking
          ? 'parking'
          : defaultKind;

    setKind(resolvedKind);
    setTower('');
    setUnitNumber('');
    setUnitTouched(false);
    setPropertyDisplayName('');
    setDevelopmentName('');
    setParkingTower('');
    setLevel('');
    setSlotNumber('');
    setError(null);
  }, [open, canAddProperty, canAddParking, defaultKind]);

  // Fill the residence and its first parking tower once options arrive.
  useEffect(() => {
    if (!open || developmentName) return;
    const first = residenceOptions[0];
    if (!first) return;
    const profile = toResidenceProfile(first);
    const firstParkingTower = activeParkingTowers(profile)[0];
    setDevelopmentName(first.name ?? '');
    setParkingTower(firstParkingTower?.name ?? '');
    setLevel(firstParkingTower?.levels[0] ?? '');
  }, [open, developmentName, residenceOptions]);

  useEffect(() => {
    setError(null);
  }, [kind, tower, unitNumber, parkingTower, level, slotNumber, developmentName]);

  // The residence and its first parking tower are prefilled, so only a typed value counts
  // as an unsaved edit here.
  const isDirty =
    open &&
    (tower !== '' || unitNumber !== '' || propertyDisplayName !== '' || slotNumber !== '');
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: () => (canSubmit && !isPending ? handleSubmit() : false),
  });

  const handleDevelopmentChange = (name: string) => {
    setDevelopmentName(name);
    setTower('');
    setUnitNumber('');
    setUnitTouched(false);
    setParkingTower('');
    setLevel('');
    setSlotNumber('');

    const next = residenceOptions.find((option) => option.name === name);
    if (!next) return;
    const profile = toResidenceProfile(next);
    const firstParkingTower = activeParkingTowers(profile)[0];
    setParkingTower(firstParkingTower?.name ?? '');
    setLevel(firstParkingTower?.levels[0] ?? '');
  };

  const handleParkingTowerChange = (value: string) => {
    setParkingTower(value);
    const levels = residenceProfile ? parkingLevelsForTower(residenceProfile, value) : [];
    if (!levels.includes(level)) setLevel(levels[0] ?? '');
  };

  const handleSubmit = async (): Promise<boolean> => {
    if (activeKind === 'property') {
      setUnitTouched(true);
      if (!propertyCanSubmit || !towerResult.ok || !residenceProfile) return false;

      const resolvedName =
        propertyDisplayName.trim() || formatUnitLabel(residenceProfile, tower, unitNumber);
      if (resolvedName.length < 2) {
        setError('Display name must be at least 2 characters');
        return false;
      }
      if (propertyNameBlocked) {
        setError(propertyNameBlockMessage ?? 'This name is reserved and cannot be used');
        return false;
      }

      setError(null);
      try {
        const result = await createProperty.mutateAsync({
          orgId,
          orgSlug,
          name: resolvedName,
          tower,
          unitNumber,
          residenceName: selectedResidence?.name ?? undefined,
          developmentId: residenceProfile.developmentId ?? undefined,
        });
        runUnguarded(() => {
          onOpenChange(false);
          onPropertyCreated?.(result.property);
          if (result.billingRequired) {
            toast.message('Cover this property on your plan');
            const planId = orgPlan?.subscription?.planId;
            navigate(
              planId
                ? `${orgPlansPath(orgSlug)}?reviewPlan=${encodeURIComponent(planId)}`
                : orgPlansPath(orgSlug)
            );
          }
        });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add property');
        return false;
      }
    }

    if (
      !parkingCanSubmit ||
      !parkingTower ||
      !level ||
      !parkingDisplayName ||
      !residenceProfile
    ) {
      return false;
    }
    setError(null);
    try {
      const { parking } = await createParking.mutateAsync({
        orgId,
        orgSlug,
        name: parkingDisplayName,
        tower: parkingTower,
        level,
        slotLabel: slotNumber.trim(),
        parkingType: parkingTypeForTower(residenceProfile, parkingTower),
        residenceName: selectedResidence?.name ?? undefined,
        developmentId: residenceProfile.developmentId ?? undefined,
      });
      runUnguarded(() => {
        onOpenChange(false);
        onParkingCreated?.(parking);
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add parking');
      return false;
    }
  };

  const propertyFieldErrorClass =
    towerUnitReady && propertyListed ? 'border-amber-500/40' : undefined;

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title="New listing"
        description={`Add to ${orgName}`}
        sizeClassName="max-w-[min(calc(100vw-1.5rem),26rem)] sm:max-w-[min(90vw,28rem)]"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={isPending}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || isPending}
              className="min-h-[44px]"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : activeKind === 'property' ? (
                'Add property'
              ) : (
                'Add parking'
              )}
            </Button>
          </>
        }
      >
        {showKindToggle ? <KindToggle kind={kind} onKindChange={setKind} /> : null}

        <div className={cn(showKindToggle && 'mt-3', 'space-y-3')}>
          <DevelopmentField
            id="add-entity-development"
            value={developmentName}
            options={residenceOptions
              .map((option) => option.name ?? '')
              .filter((name) => name.length > 0)}
            loading={residenceOptionsLoading}
            onChange={handleDevelopmentChange}
          />

          {activeKind === 'property' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {propertyTowerOptions.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="add-entity-property-tower">
                      {residenceProfile?.structure.towerLabel ?? 'Tower'}
                    </Label>
                    <Select
                      value={tower || undefined}
                      onValueChange={(value) => setTower(value)}
                    >
                      <SelectTrigger
                        id="add-entity-property-tower"
                        className={cn('h-10', propertyFieldErrorClass)}
                        aria-invalid={undefined}
                      >
                        <SelectValue placeholder="Select tower" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {propertyTowerOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="add-entity-property-unit">
                    {residenceProfile?.structure.unitLabel ?? 'Unit'}
                  </Label>
                  <AvailabilityCheckInput
                    id="add-entity-property-unit"
                    inputMode={unitInputMode}
                    autoComplete="off"
                    value={unitNumber}
                    onChange={(e) =>
                      setUnitNumber(
                        unitInputMode === 'numeric'
                          ? e.target.value.replace(/\D/g, '').slice(0, unitMaxLength)
                          : e.target.value.slice(0, unitMaxLength)
                      )
                    }
                    onBlur={() => setUnitTouched(true)}
                    placeholder={unitFormat?.example ?? FORM_PLACEHOLDERS.unitNumber}
                    maxLength={unitMaxLength}
                    aria-invalid={unitInvalid || undefined}
                    className={cn(
                      'h-10',
                      unitInputMode === 'numeric' && 'tabular-nums',
                      propertyFieldErrorClass
                    )}
                    checkState={unitAvailabilityState}
                  />
                  {unitInvalid ? (
                    <p role="alert" className="text-destructive text-xs">
                      {unitMessage}
                    </p>
                  ) : null}
                </div>
              </div>

              {towerUnitReady && propertyListed ? (
                <TowerUnitConflictAlert tower={tower} unitNumber={unitNumber} conflict={conflict} />
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="add-entity-property-name">Display name</Label>
                <AvailabilityCheckInput
                  id="add-entity-property-name"
                  value={propertyDisplayName}
                  onChange={(e) => setPropertyDisplayName(e.target.value)}
                  placeholder={
                    towerUnitReady && residenceProfile
                      ? formatUnitLabel(residenceProfile, tower, unitNumber)
                      : FORM_PLACEHOLDERS.towerAndUnit
                  }
                  maxLength={120}
                  autoComplete="off"
                  aria-invalid={Boolean(propertyNameBlockMessage)}
                  className={cn('h-10', propertyNameBlockMessage && 'border-destructive')}
                  checkState={propertyNameAvailabilityState}
                />
                {propertyNameBlockMessage ? (
                  <p role="alert" className="text-destructive text-xs">
                    {propertyNameBlockMessage}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="add-entity-parking-tower">Tower</Label>
                  <Select
                    value={parkingTower || undefined}
                    onValueChange={handleParkingTowerChange}
                    disabled={parkingTowerOptions.length === 0}
                  >
                    <SelectTrigger id="add-entity-parking-tower" className="h-10">
                      <SelectValue placeholder="Tower" />
                    </SelectTrigger>
                    <SelectContent>
                      {parkingTowerOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-entity-parking-level">Level</Label>
                  <Select
                    value={level || undefined}
                    onValueChange={(value) => setLevel(value)}
                  >
                    <SelectTrigger id="add-entity-parking-level" className="h-10">
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      {parkingLevelOptions.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-entity-slot-number">Slot number</Label>
                <AvailabilityCheckInput
                  id="add-entity-slot-number"
                  inputMode={
                    residenceProfile?.structure.parkingSlotFormat.preset === 'digits1to4'
                      ? 'numeric'
                      : 'text'
                  }
                  autoComplete="off"
                  value={slotNumber}
                  onChange={(e) =>
                    setSlotNumber(
                      residenceProfile
                        ? sanitizeSlotLabel(residenceProfile, e.target.value)
                        : e.target.value
                    )
                  }
                  placeholder={residenceProfile?.structure.parkingSlotFormat.example ?? '26'}
                  maxLength={residenceProfile?.structure.parkingSlotFormat.preset === 'digits1to4' ? 4 : 10}
                  className={cn(
                    'h-10',
                    residenceProfile?.structure.parkingSlotFormat.preset === 'digits1to4' &&
                      'tabular-nums',
                    parkingDuplicate && 'border-destructive'
                  )}
                  aria-invalid={Boolean(parkingDuplicate)}
                  checkState={parkingSlotAvailabilityState}
                />
                {parkingDuplicate ? (
                  <p role="alert" className="text-destructive text-xs">
                    This slot is already registered
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-entity-parking-code">Code</Label>
                <Input
                  id="add-entity-parking-code"
                  value={parkingCode}
                  readOnly
                  aria-readonly="true"
                  placeholder="-"
                  className="bg-muted/40 text-muted-foreground h-10 cursor-default font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-entity-parking-name">Display name</Label>
                <Input
                  id="add-entity-parking-name"
                  value={parkingDisplayName}
                  readOnly
                  aria-readonly="true"
                  placeholder="-"
                  className="bg-muted/40 text-muted-foreground h-10 cursor-default"
                />
              </div>

              <p className="text-muted-foreground text-xs leading-relaxed">
                A platform fee applies to each booking. You can see your payout per night on Pricing
                after the listing is created.
              </p>
            </>
          )}
        </div>

        {error ? (
          <div
            className="border-destructive/20 bg-destructive/5 text-destructive mt-3 flex items-start gap-2 rounded-xl border p-3"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-[13px] leading-snug">{error}</p>
          </div>
        ) : null}
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
