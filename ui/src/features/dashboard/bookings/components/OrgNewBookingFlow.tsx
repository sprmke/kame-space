import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { Building2, CarFront } from 'lucide-react';

import { AdminNewBookingModal } from '@/features/dashboard/bookings/components/AdminNewBookingModal';
import { AdminParkingNewBookingModal } from '@/features/dashboard/parking/components/AdminParkingNewBookingModal';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import type { Parking, Property } from '@/features/dashboard/org/types';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ListingChoice =
  { kind: 'property'; property: Property } | { kind: 'parking'; parking: Parking };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string | null;
};

function isCreatableProperty(property: Property): boolean {
  return !property.archivedAt && property.status !== 'ARCHIVED';
}

function isCreatableParking(parking: Parking): boolean {
  return parking.status !== 'ARCHIVED';
}

/**
 * Org Bookings → New booking: pick a property or parking listing, then open the
 * same create modal that listing's own Bookings page uses. One listing skips
 * the picker.
 */
export function OrgNewBookingFlow({ open, onOpenChange, orgSlug }: Props) {
  const { data: propertiesData, isLoading: propertiesLoading } = useProperties(
    orgSlug ?? undefined
  );
  const { data: parkingsData, isLoading: parkingsLoading } = useParkings(orgSlug ?? undefined);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [propertyTarget, setPropertyTarget] = useState<Property | null>(null);
  const [parkingTarget, setParkingTarget] = useState<Parking | null>(null);
  /** True after this open cycle has chosen picker vs auto-select. */
  const [routed, setRouted] = useState(false);

  const properties = useMemo(
    () => (propertiesData?.properties ?? []).filter(isCreatableProperty),
    [propertiesData]
  );
  const parkings = useMemo(
    () => (parkingsData?.parkings ?? []).filter(isCreatableParking),
    [parkingsData]
  );
  const listingsLoading = propertiesLoading || parkingsLoading;
  const totalChoices = properties.length + parkings.length;

  const resetFlow = useCallback(() => {
    setPickerOpen(false);
    setPropertyTarget(null);
    setParkingTarget(null);
    setRouted(false);
  }, []);

  const closeAll = useCallback(() => {
    resetFlow();
    onOpenChange(false);
  }, [onOpenChange, resetFlow]);

  const openChoice = useCallback((choice: ListingChoice) => {
    setPickerOpen(false);
    if (choice.kind === 'property') {
      setParkingTarget(null);
      setPropertyTarget(choice.property);
      return;
    }
    setPropertyTarget(null);
    setParkingTarget(choice.parking);
  }, []);

  useEffect(() => {
    if (!open) {
      resetFlow();
      return;
    }
    if (routed || listingsLoading) {
      if (open && listingsLoading && !pickerOpen && !propertyTarget && !parkingTarget) {
        setPickerOpen(true);
      }
      return;
    }

    setRouted(true);
    if (totalChoices === 1 && properties[0]) {
      setPickerOpen(false);
      setPropertyTarget(properties[0]);
      return;
    }
    if (totalChoices === 1 && parkings[0]) {
      setPickerOpen(false);
      setParkingTarget(parkings[0]);
      return;
    }
    setPickerOpen(true);
  }, [
    open,
    routed,
    listingsLoading,
    totalChoices,
    properties,
    parkings,
    pickerOpen,
    propertyTarget,
    parkingTarget,
    resetFlow,
  ]);

  return (
    <>
      <ResponsiveModal
        open={pickerOpen}
        onOpenChange={(next) => {
          if (!next) closeAll();
          else setPickerOpen(true);
        }}
      >
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(92dvh,36rem)] min-h-0 flex-col overflow-hidden sm:max-w-md"
        >
          <ResponsiveModalHeader className="shrink-0 px-4 sm:px-5">
            <ResponsiveModalTitle>New booking</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3">
            {listingsLoading ? (
              <div className="space-y-2 px-2 py-2">
                {[0, 1, 2].map((row) => (
                  <Skeleton key={row} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : totalChoices === 0 ? (
              <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                No properties or parking slots to book yet.
              </p>
            ) : (
              <div className="space-y-4">
                {properties.length > 0 ? (
                  <ListingGroup label="Properties">
                    {properties.map((property) => (
                      <ListingRow
                        key={property.id}
                        icon={<Building2 className="size-4" aria-hidden />}
                        label={property.name}
                        description={
                          property.status === 'ACTIVE'
                            ? undefined
                            : property.status === 'INACTIVE'
                              ? 'Paused'
                              : property.status
                        }
                        onSelect={() => openChoice({ kind: 'property', property })}
                      />
                    ))}
                  </ListingGroup>
                ) : null}

                {parkings.length > 0 ? (
                  <ListingGroup label="Parking">
                    {parkings.map((parking) => (
                      <ListingRow
                        key={parking.id}
                        icon={<CarFront className="size-4" aria-hidden />}
                        label={parking.name}
                        description={
                          [parking.residenceName, parking.tower, parking.slotLabel]
                            .filter(Boolean)
                            .join(' · ') || undefined
                        }
                        onSelect={() => openChoice({ kind: 'parking', parking })}
                      />
                    ))}
                  </ListingGroup>
                ) : null}
              </div>
            )}
          </div>

          <ResponsiveModalFooter className="shrink-0 px-4 sm:px-5">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={closeAll}>
              Cancel
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <AdminNewBookingModal
        open={Boolean(propertyTarget)}
        onOpenChange={(next) => {
          if (!next) closeAll();
        }}
        orgSlug={orgSlug}
        propertySlug={propertyTarget?.slug ?? null}
      />

      {parkingTarget ? (
        <AdminParkingNewBookingModal
          open
          onOpenChange={(next) => {
            if (!next) closeAll();
          }}
          orgSlug={orgSlug}
          parkingSlug={parkingTarget.slug}
          parkingId={parkingTarget.id}
          towerLabel={parkingTarget.tower}
        />
      ) : null}
    </>
  );
}

function ListingGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function ListingRow({
  icon,
  label,
  description,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
          'hover:bg-muted/50 active:bg-muted/70'
        )}
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm font-semibold">{label}</span>
          {description ? (
            <span className="text-muted-foreground block truncate text-xs">{description}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
