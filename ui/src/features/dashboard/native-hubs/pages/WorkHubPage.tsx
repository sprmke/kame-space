import { useMemo, useState } from 'react';

import { Link, Navigate, useLocation, useParams } from 'react-router-dom';

import { openAiAssistant } from '@/features/dashboard/ai-assistant/lib/assistantOpenStore';
import {
  buildOrgNavSections,
  buildParkingNavSections,
  buildPropertyNavSections,
  filterOrgNavSections,
  filterParkingNavSections,
  filterPropertyNavSections,
  isOrgAdminPath,
  isParkingAdminPath,
  isPropertyAdminPath,
  type SidebarNavItem,
  type SidebarNavSection,
} from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { adminScopeRootPath } from '@/features/dashboard/native-hubs/lib/hubScope';
import { listWorkRecent } from '@/features/dashboard/native-hubs/lib/workRecent';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrganizations, useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { useParkingPermissions } from '@/features/dashboard/team/hooks/useParkingPermissions';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';

import { AdminMobilePage } from '@/components/mobile/AdminMobilePage';
import { IconTile } from '@/components/mobile/native/IconTile';
import { ListRow } from '@/components/mobile/native/ListRow';
import { ListSection } from '@/components/mobile/native/ListSection';
import { SearchField } from '@/components/mobile/native/SearchField';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

function flattenNavigable(sections: SidebarNavSection[]): SidebarNavItem[] {
  return sections.flatMap((section) =>
    section.items.filter((item): item is SidebarNavItem & { href: string } =>
      Boolean(item.href && !item.disabled)
    )
  );
}

export function WorkHubPage() {
  const isMobile = useIsBelowLg();
  const location = useLocation();
  const { orgSlug: routeOrgSlug, propertySlug: routePropertySlug, parkingSlug: routeParkingSlug } =
    useParams<{ orgSlug?: string; propertySlug?: string; parkingSlug?: string }>();
  const tenant = useOptionalOrgContext();
  const parkingTenant = useOptionalParkingContext();
  const orgSlug = tenant?.orgSlug ?? parkingTenant?.orgSlug ?? routeOrgSlug;
  const propertySlug = tenant?.propertySlug ?? routePropertySlug;
  const parkingSlug = parkingTenant?.parkingSlug ?? routeParkingSlug;
  const root = adminScopeRootPath({
    pathname: location.pathname,
    orgSlug,
    propertySlug,
    parkingSlug,
  });

  usePageTitle(
    tenant?.property?.name
      ? `${tenant.property.name} - Work`
      : parkingTenant?.parking?.name && parkingTenant.org?.name
        ? `${parkingTenant.org.name} - ${parkingTenant.parking.name} - Work`
        : undefined
  );

  const propertyPermissions = usePropertyPermissions();
  const parkingPermissions = useParkingPermissions();
  const orgPermissions = useOrgPermissions();
  const { data: orgsData } = useOrganizations();
  const { data: propertiesData } = useProperties(orgSlug);
  const { data: parkingsData } = useParkings(orgSlug);

  const sections = useMemo(() => {
    if (!orgSlug) return [] as SidebarNavSection[];
    if (isPropertyAdminPath(location.pathname) && propertySlug) {
      const raw = buildPropertyNavSections(orgSlug, propertySlug);
      return filterPropertyNavSections(raw, propertyPermissions.data?.permissions);
    }
    if (isParkingAdminPath(location.pathname) && parkingSlug) {
      const raw = buildParkingNavSections(orgSlug, parkingSlug);
      return filterParkingNavSections(raw, parkingPermissions.data?.permissions);
    }
    if (isOrgAdminPath(location.pathname)) {
      const org = orgsData?.organizations.find((o) => o.slug === orgSlug);
      const raw = buildOrgNavSections(orgSlug, {
        showProperties: (org?.hostModes ?? []).includes('property') || (propertiesData?.properties.length ?? 0) > 0,
        showParkings: (org?.hostModes ?? []).includes('parking') || (parkingsData?.parkings.length ?? 0) > 0,
      });
      return filterOrgNavSections(raw, orgPermissions.data?.permissions);
    }
    return [];
  }, [
    orgSlug,
    propertySlug,
    parkingSlug,
    location.pathname,
    propertyPermissions.data?.permissions,
    parkingPermissions.data?.permissions,
    orgPermissions.data?.permissions,
    orgsData?.organizations,
    propertiesData?.properties.length,
    parkingsData?.parkings.length,
  ]);

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const navigable = useMemo(() => flattenNavigable(sections), [sections]);
  const filteredSections = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.href && !item.disabled && item.label.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, q]);

  const recent = listWorkRecent();
  const askFallback = q.length > 0 && navigable.every((item) => !item.label.toLowerCase().includes(q));

  if (!isMobile && root) {
    return <Navigate to={root} replace />;
  }

  return (
    <AdminMobilePage title="Work">
      <div className="space-y-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Find a tool or action"
          aria-label="Find a tool or action"
        />

        {!q && recent.length > 0 ? (
          <ListSection title="Continue">
            {recent.map((entry) => (
              <Link key={entry.href} to={entry.href} className="block">
                <ListRow title={entry.label} chevron />
              </Link>
            ))}
          </ListSection>
        ) : null}

        {filteredSections.map((section) => {
          const items = section.items.filter((item) => item.href && !item.disabled);
          if (items.length === 0) return null;
          return (
            <div key={section.label} className="space-y-2">
              {section.label && !section.hideLabel ? (
                <p className="text-muted-foreground px-1 text-[0.6875rem] font-semibold uppercase tracking-wider">
                  {section.label}
                </p>
              ) : null}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href!}
                    className={cn(
                      'native-v3-press bg-card border-hairline flex flex-col items-center gap-2 rounded-xl border p-3 text-center'
                    )}
                  >
                    <IconTile icon={item.Icon} />
                    <span className="text-native-meta text-foreground line-clamp-2 text-[11px] font-medium leading-tight">
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {askFallback ? (
          <button
            type="button"
            onClick={() => openAiAssistant()}
            className="native-v3-press border-hairline bg-tint text-tint-foreground flex min-h-11 w-full items-center justify-center rounded-xl border px-3 text-sm font-medium"
          >
            Ask Kame about &lsquo;{query.trim()}&rsquo;
          </button>
        ) : null}
      </div>
    </AdminMobilePage>
  );
}
