import {
  isOrgAdminPath,
  isParkingAdminPath,
  isPropertyAdminPath,
  isSuperAdminPath,
} from '@/features/dashboard/bookings/lib/adminSidebarNav';
import {
  orgDashboardPath,
  parkingDashboardPath,
  propertyDashboardPath,
} from '@/features/dashboard/org/lib/tenantPaths';

/** Scope root path for Today / lg+ redirects from Work and You. */
export function adminScopeRootPath(args: {
  pathname: string;
  orgSlug?: string;
  propertySlug?: string;
  parkingSlug?: string;
}): string | null {
  const { pathname, orgSlug, propertySlug, parkingSlug } = args;
  if (isSuperAdminPath(pathname)) return '/admin';
  if (!orgSlug) return null;
  if (isPropertyAdminPath(pathname) && propertySlug) {
    return propertyDashboardPath(orgSlug, propertySlug);
  }
  if (isParkingAdminPath(pathname) && parkingSlug) {
    return parkingDashboardPath(orgSlug, parkingSlug);
  }
  if (isOrgAdminPath(pathname)) return orgDashboardPath(orgSlug);
  return null;
}

export function adminWorkPath(root: string): string {
  return `${root.replace(/\/+$/, '')}/work`;
}

export function adminYouPath(root: string): string {
  return `${root.replace(/\/+$/, '')}/you`;
}
