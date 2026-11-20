import { useState } from 'react';

import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';

import { ChevronRight, LogOut } from 'lucide-react';

import { AccountAvatar } from '@/features/guest/account/components/AccountAvatar';
import { GuestProfileModal } from '@/features/guest/account/components/GuestProfileModal';
import { useAccountIdentity } from '@/features/guest/account/hooks/useAccountIdentity';
import { hostLoginPath } from '@/features/guest/auth/lib/hostAuthPaths';
import { ModeSwitcher } from '@/features/guest/marketing/shared/components/ModeSwitcher';

import { DashboardModeToggle } from '@/features/dashboard/ai-assistant/components/DashboardModeToggle';
import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import {
  isOrgAdminPath,
  isParkingAdminPath,
  isPropertyAdminPath,
  isSuperAdminPath,
} from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { adminScopeRootPath } from '@/features/dashboard/native-hubs/lib/hubScope';
import { ListingVerificationSidebarCta } from '@/features/dashboard/org/components/listing-authorization/ListingVerificationSidebarCta';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { SidebarTenantScope } from '@/features/dashboard/org/components/TenantSwitchers';
import { GetVerifiedSidebarCta } from '@/features/dashboard/org/components/verification/GetVerifiedModal';
import { orgPlansPath } from '@/features/dashboard/org/lib/tenantPaths';
import { OrgPlanSidebarEntry } from '@/features/dashboard/plans/components/OrgPlanSidebarEntry';
import { SuperAdminSidebarScope } from '@/features/dashboard/super-admin/components/SuperAdminSidebarScope';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks';
import { AdminMobilePage } from '@/components/mobile/AdminMobilePage';
import { ListRow } from '@/components/mobile/native/ListRow';
import { ListSection } from '@/components/mobile/native/ListSection';
import { InstallAppEntry } from '@/components/pwa/InstallAppEntry';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import {
  orgPageTitle,
  parkingDashboardPageTitle,
  propertyDashboardPageTitle,
  usePageTitle,
} from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

export function YouHubPage() {
  const isMobile = useIsBelowLg();
  const location = useLocation();
  const navigate = useNavigate();
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
  const superAdmin = isSuperAdminPath(location.pathname);
  const { email, signOut } = useAdminSession();
  const { displayName, avatarUrl, initials } = useAccountIdentity();
  const [profileOpen, setProfileOpen] = useState(false);

  const title = (() => {
    if (superAdmin) return 'You';
    if (tenant?.property?.name) return propertyDashboardPageTitle(tenant.property.name, 'You');
    if (parkingTenant?.parking?.name && parkingTenant.org?.name) {
      return parkingDashboardPageTitle(parkingTenant.org.name, parkingTenant.parking.name, 'You');
    }
    if (tenant?.org?.name) return orgPageTitle(tenant.org.name, 'You');
    return undefined;
  })();
  usePageTitle(title);

  const helpHref = root ? `${root.replace(/\/+$/, '')}/help-support` : null;
  const plansHref = orgSlug && !superAdmin ? orgPlansPath(orgSlug) : null;
  const notificationsHref =
    root && !superAdmin && !isOrgAdminPath(location.pathname)
      ? `${root.replace(/\/+$/, '')}/notifications`
      : null;

  if (!isMobile && root) {
    return <Navigate to={root} replace />;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate(hostLoginPath(), { replace: true });
    } catch (err) {
      console.error('[YouHubPage] signOut failed', err);
    }
  };

  return (
    <AdminMobilePage title="You">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className={cn(
            'native-v3-press border-hairline bg-card flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left'
          )}
        >
          <AccountAvatar
            avatarUrl={avatarUrl}
            initials={initials}
            className="ring-background size-11 shrink-0 shadow-sm ring-2"
            fallbackClassName="text-sm"
          />
          <span className="min-w-0 flex-1">
            <span className="text-foreground block truncate text-[15px] font-semibold leading-tight">
              {displayName}
            </span>
            {email ? (
              <span className="text-muted-foreground mt-0.5 block truncate text-[12px] leading-tight">
                {email}
              </span>
            ) : null}
          </span>
          <ChevronRight className="text-muted-foreground size-5 shrink-0" aria-hidden />
        </button>

        <ListSection title="Workspace">
          <div className="px-3 py-2">
            {superAdmin ? (
              <SuperAdminSidebarScope collapsed={false} />
            ) : (
              <SidebarTenantScope collapsed={false} />
            )}
          </div>
        </ListSection>

        {!superAdmin ? (
          <ListSection title="Organization">
            <div className="px-2 py-1">
              <OrgPlanSidebarEntry variant="more" />
            </div>
            {plansHref ? (
              <Link to={plansHref} className="block">
                <ListRow title="Plans & Billing" chevron />
              </Link>
            ) : null}
          </ListSection>
        ) : null}

        <ListSection title="Notifications">
          {notificationsHref && !superAdmin ? (
            <Link to={notificationsHref} className="block">
              <ListRow title="Preferences" chevron />
            </Link>
          ) : (
            <ListRow title="Preferences" meta="Open from Alerts" />
          )}
        </ListSection>

        <ListSection title="App">
          <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
            <ThemeToggle
              variant="icon"
              className="border-border/60 bg-muted text-muted-foreground size-10 shrink-0 rounded-lg shadow-none [&_svg]:size-4"
            />
            <ModeSwitcher className="min-w-0 flex-1" />
          </div>
          {!superAdmin ? (
            <div className="border-b border-hairline px-1 py-1">
              <DashboardModeToggle className="hover:bg-muted/60 h-auto min-h-11 gap-3" />
            </div>
          ) : null}
          <div className="px-1 py-1">
            <InstallAppEntry
              variant="menu-item"
              className="hover:bg-muted/60 text-foreground h-auto min-h-11 w-full justify-start gap-3 px-2 text-sm font-medium"
            />
          </div>
        </ListSection>

        {helpHref ? (
          <ListSection title="Help">
            <Link to={helpHref} className="block">
              <ListRow title="Help & support" chevron />
            </Link>
          </ListSection>
        ) : null}

        {superAdmin ? (
          <ListSection title="Console">
            <Link to={superAdminPaths.root} className="block">
              <ListRow title="Super-admin console" chevron />
            </Link>
          </ListSection>
        ) : null}

        <div className="flex items-center gap-2 px-1">
          {!superAdmin ? (
            isPropertyAdminPath(location.pathname) || isParkingAdminPath(location.pathname) ? (
              <ListingVerificationSidebarCta variant="icon" />
            ) : isOrgAdminPath(location.pathname) ? (
              <GetVerifiedSidebarCta variant="icon" />
            ) : null
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void handleSignOut()}
          className={cn(
            'border-destructive/25 bg-destructive/5 text-destructive',
            'hover:bg-destructive/10 active:bg-destructive/15',
            'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium'
          )}
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Sign out
        </button>
        <LegalFooterLinks includeCookies={false} />
      </div>

      <GuestProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </AdminMobilePage>
  );
}
