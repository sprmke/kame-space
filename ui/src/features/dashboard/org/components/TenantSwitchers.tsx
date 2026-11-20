import { useMemo, useState, type ReactNode } from 'react';

import { Link, useNavigate, useParams } from 'react-router-dom';

import { Building2, Car, Check, ChevronDown, Home, Plus } from 'lucide-react';

import { isPlatformSeedMediaUrl } from '@/features/dashboard/lib/storedMediaDisplay';
import { AddEntityDialog } from '@/features/dashboard/org/components/AddEntityDialog';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import {
  useAllOrgProperties,
  useOrganizations,
} from '@/features/dashboard/org/hooks/useOrganizations';
import { useOrgSettings } from '@/features/dashboard/org/hooks/useOrgSettings';
import { useAllOrgParkings } from '@/features/dashboard/org/hooks/useParkings';
import {
  canCreateParkingsInOrg,
  canCreatePropertiesInOrg,
  canSelectOrgInSwitcher,
  isPropertyOnlyOrgAccess,
} from '@/features/dashboard/org/lib/orgAccessKind';
import { orgParkingCardModel } from '@/features/dashboard/org/lib/orgParkingCardModel';
import { orgPropertyCardModel } from '@/features/dashboard/org/lib/orgPropertyCardModel';
import { resolveParkingCompactLabel } from '@/features/dashboard/org/lib/parkingSlotDisplay';
import {
  orgDashboardPath,
  orgPropertiesPath,
  parkingSectionPath,
  propertySectionPath,
  setLastParkingContext,
  setLastTenantContext,
} from '@/features/dashboard/org/lib/tenantPaths';
import type { Organization, Parking, Property } from '@/features/dashboard/org/types';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import type { OrgAccessPayload } from '@/features/dashboard/team/lib/orgPermissions';

import { TeamLogoMark } from '@/components/branding/TeamLogoMark';
import { ScopeChip } from '@/components/mobile/native/ScopeChip';
import { SearchField } from '@/components/mobile/native/SearchField';
import { SegmentedTabs } from '@/components/mobile/native/SegmentedTabs';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type SwitcherSegment = 'all' | 'properties' | 'parking';

function TenantSwitcherListSkeleton({ variant }: { variant: 'menu' | 'sheet' }) {
  return (
    <div
      role="status"
      className={cn(
        'min-w-0 space-y-1 overflow-hidden px-1 py-1',
        variant === 'sheet' ? 'max-h-[65vh]' : 'max-h-80'
      )}
      aria-busy="true"
      aria-label="Loading organizations"
    >
      {Array.from({ length: 3 }).map((_, orgIndex) => (
        <div key={orgIndex} className="space-y-0.5">
          {orgIndex > 0 ? <div className="bg-border/60 mx-2 my-1.5 h-px" aria-hidden /> : null}
          <div className="flex min-w-0 items-center gap-2 px-2 py-2">
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className="h-3.5 max-w-[10rem] flex-1" />
          </div>
          {Array.from({ length: orgIndex === 0 ? 2 : 1 }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex min-w-0 items-center gap-2 py-2 pl-8 pr-2">
              <Skeleton className="size-4 shrink-0 rounded" />
              <Skeleton
                className="h-3.5 flex-1"
                style={{ maxWidth: rowIndex === 0 ? '9rem' : '7rem' }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

type AddEntityTarget = { id: string; slug: string };

/**
 * Workspace switcher menus match the trigger width. The header no longer
 * sits a notification bell beside this trigger, so no extra offset is needed.
 */
const SWITCHER_MENU_WIDTH = 'w-[var(--radix-dropdown-menu-trigger-width)]';

/** Menu row — a Radix `DropdownMenuItem` in the desktop dropdown, a plain tappable row in the mobile sheet. */
function SwitcherRow({
  variant,
  onClick,
  className,
  children,
}: {
  variant: 'menu' | 'sheet';
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  if (variant === 'sheet') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'focus-visible:bg-accent active:bg-accent/70 [&>svg]:text-muted-foreground flex w-full cursor-pointer select-none items-center gap-2.5 rounded-xl px-2.5 py-3 text-left text-sm outline-none transition-colors [&>svg]:size-4 [&>svg]:shrink-0',
          className
        )}
      >
        {children}
      </button>
    );
  }
  return (
    <DropdownMenuItem onClick={onClick} className={className}>
      {children}
    </DropdownMenuItem>
  );
}

function SwitcherSeparator({ variant }: { variant: 'menu' | 'sheet' }) {
  if (variant === 'sheet') return <div className="border-border/60 my-1.5 border-t" aria-hidden />;
  return <DropdownMenuSeparator />;
}

function ContextSwitcherMenu({
  organizations,
  byOrgSlug,
  byParkingOrgSlug,
  isLoading,
  currentOrgId,
  currentPropertyId,
  currentParkingId,
  orgAccess,
  onSelectOrg,
  onSelectProperty,
  onSelectParking,
  onAddEntity,
  variant = 'menu',
  manageOrgSlug,
  onManaged,
}: {
  organizations: Organization[];
  byOrgSlug: Map<string, Property[]>;
  byParkingOrgSlug: Map<string, Parking[]>;
  isLoading: boolean;
  currentOrgId: string | undefined;
  currentPropertyId: string | undefined;
  currentParkingId: string | undefined;
  orgAccess: OrgAccessPayload | undefined;
  onSelectOrg: (org: Organization) => void;
  onSelectProperty: (org: Organization, property: Property) => void;
  onSelectParking: (org: Organization, parking: Parking) => void;
  onAddEntity: (org: Organization) => void;
  variant?: 'menu' | 'sheet';
  manageOrgSlug?: string;
  onManaged?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<SwitcherSegment>('all');
  const normalizedQuery = query.trim().toLowerCase();

  type SheetOrgRow = {
    org: Organization;
    properties: Property[];
    parkings: Parking[];
    orgMatch: boolean;
  };

  const filteredOrgs = useMemo((): SheetOrgRow[] => {
    if (variant !== 'sheet') return [];
    const rows: SheetOrgRow[] = [];
    for (const org of organizations) {
      const orgMatch = !normalizedQuery || org.name.toLowerCase().includes(normalizedQuery);
      const properties = (byOrgSlug.get(org.slug) ?? []).filter((property) => {
        if (segment === 'parking') return false;
        if (!normalizedQuery) return true;
        return property.name.toLowerCase().includes(normalizedQuery);
      });
      const parkings = (byParkingOrgSlug.get(org.slug) ?? []).filter((parking) => {
        if (segment === 'properties') return false;
        if (!normalizedQuery) return true;
        const label = resolveParkingCompactLabel(parking).toLowerCase();
        return (
          label.includes(normalizedQuery) || parking.name.toLowerCase().includes(normalizedQuery)
        );
      });
      if (!orgMatch && properties.length === 0 && parkings.length === 0) continue;
      rows.push({ org, properties, parkings, orgMatch });
    }
    return rows;
  }, [organizations, byOrgSlug, byParkingOrgSlug, normalizedQuery, segment, variant]);

  if (isLoading) {
    return <TenantSwitcherListSkeleton variant={variant} />;
  }

  const listBody =
    variant === 'sheet' ? (
      filteredOrgs.map((row, orgIndex) => {
        const { org, properties, parkings, orgMatch } = row;
        const canSelectOrg = canSelectOrgInSwitcher(org.accessKind);
        const createFlags =
          orgAccess?.orgId === org.id
            ? {
                canCreateProperties: orgAccess.canCreateProperties,
                canCreateParkings: orgAccess.canCreateParkings,
              }
            : undefined;
        const canAdd =
          canSelectOrg &&
          (canCreatePropertiesInOrg(org.accessKind, createFlags?.canCreateProperties) ||
            canCreateParkingsInOrg(org.accessKind, createFlags?.canCreateParkings));
        const showOrgRow = segment === 'all' && (orgMatch || !normalizedQuery);
        const activeProps = properties.filter((p) => p.inactiveReason !== 'archived');
        const archivedProps = properties.filter((p) => p.inactiveReason === 'archived');

        return (
          <div key={org.id}>
            {orgIndex > 0 ? <SwitcherSeparator variant={variant} /> : null}

            {showOrgRow ? (
              <div className="flex min-w-0 items-center gap-1 pr-1">
                {canSelectOrg ? (
                  <SwitcherRow
                    variant={variant}
                    onClick={() => onSelectOrg(org)}
                    className="min-w-0 flex-1"
                  >
                    <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {org.name}
                      <span className="text-muted-foreground font-normal"> · Organization</span>
                    </span>
                    {!currentPropertyId && !currentParkingId && currentOrgId === org.id ? (
                      <Check className="text-primary size-4 shrink-0" aria-hidden />
                    ) : null}
                  </SwitcherRow>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-sm">
                    <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="text-muted-foreground min-w-0 flex-1 truncate font-medium">
                      {org.name}
                    </span>
                  </div>
                )}
                {canAdd ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddEntity(org);
                    }}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
                    title={`Add to ${org.name}`}
                    aria-label={`Add to ${org.name}`}
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
                {org.name}
              </p>
            )}

            {segment !== 'parking'
              ? activeProps.map((property) => (
                  <SwitcherRow
                    key={property.id}
                    variant={variant}
                    onClick={() => onSelectProperty(org, property)}
                    className="pl-8"
                  >
                    <Home className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{property.name}</span>
                    {currentPropertyId === property.id ? (
                      <Check className="text-primary size-4 shrink-0" aria-hidden />
                    ) : null}
                  </SwitcherRow>
                ))
              : null}

            {segment !== 'parking' && archivedProps.length > 0 ? (
              <>
                <p className="text-muted-foreground pl-8 pt-1 text-[11px] font-semibold uppercase tracking-wide">
                  Archived
                </p>
                {archivedProps.map((property) => (
                  <SwitcherRow
                    key={property.id}
                    variant={variant}
                    onClick={() => onSelectProperty(org, property)}
                    className="pl-8"
                  >
                    <Home className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="text-muted-foreground min-w-0 flex-1 truncate">
                      {property.name}
                    </span>
                    {currentPropertyId === property.id ? (
                      <Check className="text-primary size-4 shrink-0" aria-hidden />
                    ) : null}
                  </SwitcherRow>
                ))}
              </>
            ) : null}

            {segment !== 'properties'
              ? parkings.map((parking) => (
                  <SwitcherRow
                    key={parking.id}
                    variant={variant}
                    onClick={() => onSelectParking(org, parking)}
                    className="pl-8"
                  >
                    <Car className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate" title={parking.name}>
                      {resolveParkingCompactLabel(parking)}
                    </span>
                    {currentParkingId === parking.id ? (
                      <Check className="text-primary size-4 shrink-0" aria-hidden />
                    ) : null}
                  </SwitcherRow>
                ))
              : null}
          </div>
        );
      })
    ) : (
      organizations.map((org, orgIndex) => {
        const properties = byOrgSlug.get(org.slug) ?? [];
        const parkings = byParkingOrgSlug.get(org.slug) ?? [];
        const canSelectOrg = canSelectOrgInSwitcher(org.accessKind);
        const createFlags =
          orgAccess?.orgId === org.id
            ? {
                canCreateProperties: orgAccess.canCreateProperties,
                canCreateParkings: orgAccess.canCreateParkings,
              }
            : undefined;
        const canAdd =
          canSelectOrg &&
          (canCreatePropertiesInOrg(org.accessKind, createFlags?.canCreateProperties) ||
            canCreateParkingsInOrg(org.accessKind, createFlags?.canCreateParkings));

        return (
          <div key={org.id}>
            {orgIndex > 0 ? <SwitcherSeparator variant={variant} /> : null}

            <div className="flex min-w-0 items-center gap-1 pr-1">
              {canSelectOrg ? (
                <SwitcherRow
                  variant={variant}
                  onClick={() => onSelectOrg(org)}
                  className="min-w-0 flex-1"
                >
                  <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{org.name}</span>
                  {!currentPropertyId && !currentParkingId && currentOrgId === org.id ? (
                    <Check className="text-primary size-4 shrink-0" aria-hidden />
                  ) : null}
                </SwitcherRow>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-sm">
                  <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span className="text-muted-foreground min-w-0 flex-1 truncate font-medium">
                    {org.name}
                  </span>
                </div>
              )}
              {canAdd ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddEntity(org);
                  }}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
                  title={`Add to ${org.name}`}
                  aria-label={`Add to ${org.name}`}
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>

            {properties
              .filter((property) => property.inactiveReason !== 'archived')
              .map((property) => (
                <SwitcherRow
                  key={property.id}
                  variant={variant}
                  onClick={() => onSelectProperty(org, property)}
                  className="pl-8"
                >
                  <Home className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{property.name}</span>
                  {currentPropertyId === property.id ? (
                    <Check className="text-primary size-4 shrink-0" aria-hidden />
                  ) : null}
                </SwitcherRow>
              ))}

            {properties.some((property) => property.inactiveReason === 'archived') ? (
              <p className="text-muted-foreground pl-8 pt-1 text-[11px] font-semibold uppercase tracking-wide">
                Archived
              </p>
            ) : null}

            {properties
              .filter((property) => property.inactiveReason === 'archived')
              .map((property) => (
                <SwitcherRow
                  key={property.id}
                  variant={variant}
                  onClick={() => onSelectProperty(org, property)}
                  className="pl-8"
                >
                  <Home className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span className="text-muted-foreground min-w-0 flex-1 truncate">
                    {property.name}
                  </span>
                  {currentPropertyId === property.id ? (
                    <Check className="text-primary size-4 shrink-0" aria-hidden />
                  ) : null}
                </SwitcherRow>
              ))}

            {parkings.map((parking) => (
              <SwitcherRow
                key={parking.id}
                variant={variant}
                onClick={() => onSelectParking(org, parking)}
                className="pl-8"
              >
                <Car className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={parking.name}>
                  {resolveParkingCompactLabel(parking)}
                </span>
                {currentParkingId === parking.id ? (
                  <Check className="text-primary size-4 shrink-0" aria-hidden />
                ) : null}
              </SwitcherRow>
            ))}
          </div>
        );
      })
    );

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {variant === 'sheet' ? (
        <div className="space-y-2 px-1">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search workspaces"
            aria-label="Search workspaces"
          />
          <SegmentedTabs
            items={[
              { key: 'all', label: 'All' },
              { key: 'properties', label: 'Properties' },
              { key: 'parking', label: 'Parking' },
            ]}
            value={segment}
            onChange={(key) => setSegment(key as SwitcherSegment)}
          />
        </div>
      ) : null}
      <div
        className={cn(
          'min-w-0 overflow-y-auto overflow-x-hidden',
          variant === 'sheet' ? 'max-h-[50vh]' : 'max-h-80'
        )}
      >
        {variant === 'sheet' && filteredOrgs.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">No matches</p>
        ) : (
          listBody
        )}
      </div>
      {variant === 'sheet' && manageOrgSlug ? (
        <div className="border-hairline border-t px-1 pt-2">
          <Link
            to={orgPropertiesPath(manageOrgSlug)}
            onClick={onManaged}
            className="text-primary flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold"
          >
            Manage workspaces
          </Link>
        </div>
      ) : null}
    </div>
  );
}

type TenantScopeVariant = 'default' | 'onPrimary';

export function SidebarTenantScope({
  collapsed = false,
  variant = 'default',
}: {
  collapsed?: boolean;
  variant?: TenantScopeVariant;
}) {
  const onPrimary = variant === 'onPrimary';
  const navigate = useNavigate();
  const { orgSlug: routeOrgSlug } = useParams<{ orgSlug?: string }>();
  const tenant = useOptionalOrgContext();
  const parkingTenant = useOptionalParkingContext();
  const { data: orgData } = useOrganizations();
  const { data: orgSettings } = useOrgSettings();
  const { data: orgAccess } = useOrgPermissions();
  const organizations = orgData?.organizations ?? [];
  const { byOrgSlug, isLoading: propsLoading } = useAllOrgProperties(organizations);
  const { byOrgSlug: byParkingOrgSlug, isLoading: parkingsLoading } =
    useAllOrgParkings(organizations);
  const isMobileLayout = useIsBelowLg();

  const [isOpen, setIsOpen] = useState(false);
  const [addEntityTarget, setAddEntityTarget] = useState<AddEntityTarget | null>(null);
  const [addEntityOpen, setAddEntityOpen] = useState(false);

  const currentOrg =
    tenant?.org ??
    parkingTenant?.org ??
    organizations.find((org) => org.slug === routeOrgSlug) ??
    organizations[0];

  if (!currentOrg) return null;

  const currentProperty = tenant?.property;
  const currentParking = parkingTenant?.parking;
  const currentOrgProperties = byOrgSlug.get(currentOrg.slug) ?? [];
  const currentOrgParkings = byParkingOrgSlug.get(currentOrg.slug) ?? [];
  const propertyOnlyOrg = isPropertyOnlyOrgAccess(currentOrg.accessKind);
  const showWorkspaceSwitcher =
    !propertyOnlyOrg || currentOrgProperties.length + currentOrgParkings.length > 1;

  const orgLogoUrl =
    orgSettings?.fieldSources.emailLogoUrl === 'db' &&
    orgSettings.emailLogoUrl &&
    !isPlatformSeedMediaUrl(orgSettings.emailLogoUrl)
      ? orgSettings.emailLogoUrl
      : currentOrg.logoUrl && !isPlatformSeedMediaUrl(currentOrg.logoUrl)
        ? currentOrg.logoUrl
        : null;

  const display = currentProperty
    ? { primary: currentProperty.name, secondary: currentOrg.name, primaryTitle: undefined }
    : currentParking
      ? {
          primary: resolveParkingCompactLabel(currentParking),
          secondary: currentOrg.name,
          primaryTitle: currentParking.name,
        }
      : { primary: currentOrg.name, secondary: 'Organization', primaryTitle: undefined };

  const contextLogoUrl = currentProperty
    ? (orgPropertyCardModel(currentProperty).thumbnailUrl ?? orgLogoUrl)
    : currentParking
      ? (orgParkingCardModel(currentParking).thumbnailUrl ?? orgLogoUrl)
      : orgLogoUrl;

  const handleSelectOrg = (org: Organization) => {
    if (!canSelectOrgInSwitcher(org.accessKind)) return;
    setIsOpen(false);
    navigate(orgDashboardPath(org.slug));
  };

  const handleSelectProperty = (org: Organization, property: Property) => {
    setIsOpen(false);
    navigate(propertySectionPath(org.slug, property.slug, 'dashboard'));
  };

  const handleSelectParking = (org: Organization, parking: Parking) => {
    setIsOpen(false);
    navigate(parkingSectionPath(org.slug, parking.slug, 'dashboard'));
  };

  const handleAddEntity = (org: Organization) => {
    setIsOpen(false);
    setAddEntityTarget({ id: org.id, slug: org.slug });
    setAddEntityOpen(true);
  };

  const menuProps = {
    organizations,
    byOrgSlug,
    byParkingOrgSlug,
    isLoading: propsLoading || parkingsLoading,
    currentOrgId: currentOrg.id,
    currentPropertyId: currentProperty?.id,
    currentParkingId: currentParking?.id,
    orgAccess,
    onSelectOrg: handleSelectOrg,
    onSelectProperty: handleSelectProperty,
    onSelectParking: handleSelectParking,
    onAddEntity: handleAddEntity,
    manageOrgSlug: currentOrg.slug,
    onManaged: () => setIsOpen(false),
  };

  const addEntityOrg = addEntityTarget
    ? organizations.find((o) => o.id === addEntityTarget.id)
    : undefined;
  const addEntityCreateFlags =
    addEntityOrg && orgAccess?.orgId === addEntityOrg.id
      ? {
          canCreateProperties: orgAccess.canCreateProperties,
          canCreateParkings: orgAccess.canCreateParkings,
        }
      : undefined;

  const addDialogs = addEntityTarget ? (
    <AddEntityDialog
      open={addEntityOpen}
      onOpenChange={(open) => {
        setAddEntityOpen(open);
        if (!open) setAddEntityTarget(null);
      }}
      orgId={addEntityTarget.id}
      orgSlug={addEntityTarget.slug}
      orgName={addEntityOrg?.name ?? addEntityTarget.slug}
      canAddProperty={canCreatePropertiesInOrg(
        addEntityOrg?.accessKind,
        addEntityCreateFlags?.canCreateProperties
      )}
      canAddParking={canCreateParkingsInOrg(
        addEntityOrg?.accessKind,
        addEntityCreateFlags?.canCreateParkings
      )}
      onPropertyCreated={(property) => {
        setLastTenantContext(addEntityTarget.slug, property.slug);
        navigate(propertySectionPath(addEntityTarget.slug, property.slug, 'dashboard'));
      }}
      onParkingCreated={(parking) => {
        setLastParkingContext(addEntityTarget.slug, parking.slug);
        navigate(parkingSectionPath(addEntityTarget.slug, parking.slug, 'dashboard'));
      }}
    />
  ) : null;

  const contextLogo = (
    <TeamLogoMark
      src={contextLogoUrl}
      name={display.primaryTitle ?? display.primary}
      alt={display.primary}
      className={cn(
        'shrink-0 shadow-none',
        onPrimary
          ? 'ring-primary-foreground/25 size-11 rounded-full ring-1'
          : 'ring-border/50 size-9 rounded-lg ring-1'
      )}
      imageClassName="object-cover"
    />
  );

  const scopeReadout = (
    <div className="flex min-w-0 items-center gap-3">
      {contextLogo}
      <div className="flex min-w-0 flex-col items-start text-left">
        <span
          className={cn(
            'w-full truncate text-sm font-semibold',
            onPrimary ? 'text-primary-foreground' : undefined
          )}
          title={display.primaryTitle}
        >
          {display.primary}
        </span>
        <span
          className={cn(
            'w-full truncate text-xs',
            onPrimary ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {display.secondary}
        </span>
      </div>
    </div>
  );

  if (!showWorkspaceSwitcher) {
    if (collapsed) {
      return (
        <>
          <div
            className="flex w-full justify-center px-3 py-3"
            aria-label={`${display.primary}, ${display.secondary}`}
          >
            {contextLogo}
          </div>
          {addDialogs}
        </>
      );
    }

    return (
      <>
        <div
          className="flex w-full px-3 py-3"
          aria-label={`${display.primary}, ${display.secondary}`}
        >
          {scopeReadout}
        </div>
        {addDialogs}
      </>
    );
  }

  if (collapsed) {
    return (
      <>
        <div className="flex w-full justify-center">
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 overflow-hidden p-0"
                aria-label="Switch workspace"
              >
                {contextLogo}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-64 overflow-hidden">
              <ContextSwitcherMenu {...menuProps} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {addDialogs}
      </>
    );
  }

  const switcherTrigger = (
    <Button
      variant="ghost"
      className={cn(
        'h-auto w-full justify-between px-3 py-3',
        onPrimary &&
          'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground'
      )}
    >
      {/* WCAG 2.5.3: the accessible name contains every visible token (initials + names). */}
      <span className="sr-only">Switch workspace: </span>
      {scopeReadout}
      <ChevronDown
        className={cn(
          'size-4 shrink-0',
          onPrimary ? 'text-primary-foreground/80' : 'text-muted-foreground'
        )}
        aria-hidden
      />
    </Button>
  );

  if (isMobileLayout) {
    const chipTrigger = onPrimary ? (
      <ScopeChip
        name={display.primary}
        parentLine={display.secondary}
        photoUrl={contextLogoUrl}
        parking={Boolean(currentParking) && !currentProperty}
        onClick={() => setIsOpen(true)}
      />
    ) : (
      switcherTrigger
    );

    return (
      <>
        <BottomSheet open={isOpen} onOpenChange={setIsOpen}>
          {onPrimary ? (
            chipTrigger
          ) : (
            <BottomSheetTrigger asChild>{chipTrigger}</BottomSheetTrigger>
          )}
          <BottomSheetContent className="gap-0 pb-[max(1rem,var(--safe-bottom))]">
            <BottomSheetHeader className="px-1 pb-2 pt-1 text-left">
              <BottomSheetTitle>Switch workspace</BottomSheetTitle>
              <BottomSheetDescription className="sr-only">
                Choose an organization, property, or parking
              </BottomSheetDescription>
            </BottomSheetHeader>
            <ContextSwitcherMenu {...menuProps} variant="sheet" />
          </BottomSheetContent>
        </BottomSheet>
        {addDialogs}
      </>
    );
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>{switcherTrigger}</DropdownMenuTrigger>

        <DropdownMenuContent className={cn(SWITCHER_MENU_WIDTH, 'overflow-hidden')} align="start">
          <ContextSwitcherMenu {...menuProps} />
        </DropdownMenuContent>
      </DropdownMenu>
      {addDialogs}
    </>
  );
}

/**
 * Workspace switcher sheet (v3). Same component as `SidebarTenantScope` on phone:
 * ScopeChip + search + All / Properties / Parking + Manage workspaces.
 */
export function WorkspaceSwitcherSheet(props: {
  collapsed?: boolean;
  variant?: TenantScopeVariant;
}) {
  return <SidebarTenantScope {...props} />;
}

/** @deprecated Use SidebarTenantScope */
export function OrgSwitcher(props: { collapsed?: boolean }) {
  return <SidebarTenantScope {...props} />;
}

/** @deprecated Use SidebarTenantScope */
export function PropertySwitcher(_props: { collapsed?: boolean }) {
  return null;
}
