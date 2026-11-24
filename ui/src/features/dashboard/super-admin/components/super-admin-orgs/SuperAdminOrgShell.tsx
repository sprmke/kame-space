import { useEffect } from 'react';

import { Link, Navigate, useLocation, useParams } from 'react-router-dom';

import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  ScrollText,
  Settings,
  Sparkles,
} from 'lucide-react';

import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import {
  AdminSectionNavLayout,
  type AdminSectionNavItem,
} from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { orgDashboardPath } from '@/features/dashboard/org/lib/tenantPaths';
import { SuperAdminRecordNotFound } from '@/features/dashboard/super-admin/components/shared/SuperAdminRecordNotFound';
import { SuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';
import { SuperAdminOrgHubSection } from '@/features/dashboard/super-admin/components/super-admin-orgs/SuperAdminOrgHubSection';
import { useSuperAdminOrgDetail } from '@/features/dashboard/super-admin/hooks/useSuperAdminOrgs';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import { SuperAdminOrgActivitySection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgActivitySection';
import { SuperAdminOrgAiSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgAiSection';
import { SuperAdminOrgApprovalsSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgApprovalsSection';
import { SuperAdminOrgListingsSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgListingsSection';
import { SuperAdminOrgOverviewSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgOverviewSection';
import { SuperAdminOrgSettingsSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgSettingsSection';
import { SuperAdminOrgSubscriptionSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgSubscriptionSection';
import { SuperAdminOrgSupportSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgSupportSection';

import {
  AdminPageHeaderSkeleton,
  AppSettingsNavLayoutSkeleton,
} from '@/components/skeletons/AdminSkeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const ORG_HUB_SECTIONS: AdminSectionNavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'listings', label: 'Listings', icon: Building2 },
  { id: 'approvals', label: 'Approvals', icon: BadgeCheck },
  { id: 'ai', label: 'AI credits', icon: Sparkles },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'activity', label: 'Activity', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function SuperAdminOrgShell() {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const { data: org, isLoading, error } = useSuperAdminOrgDetail(orgSlug);

  // Deep links from other pages (Overview attention list, AI usage top-orgs, …) land here
  // with a `#section-x` hash — scroll to it once the section content has mounted.
  useEffect(() => {
    if (!org || !location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    const timer = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => clearTimeout(timer);
  }, [org, location.hash]);

  if (!orgSlug) {
    return <Navigate to={superAdminPaths.organizations} replace />;
  }
  if (isLoading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <AdminPageHeaderSkeleton compact />
        <AppSettingsNavLayoutSkeleton
          navLabels={ORG_HUB_SECTIONS.map((section) => section.label)}
        />
      </div>
    );
  }
  if (error || !org) {
    return (
      <SuperAdminRecordNotFound
        title="Organization not found"
        description="It may have been renamed or removed."
        backTo={superAdminPaths.organizations}
        backLabel="Back to Organizations"
      />
    );
  }

  return (
    <SuperAdminOrgContext.Provider value={{ org, slug: orgSlug }}>
      <AdminSectionNavLayout
        mobileSectionNav
        sections={ORG_HUB_SECTIONS}
        header={
          <div className="space-y-1.5">
            <Link
              to={superAdminPaths.organizations}
              className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center gap-1 text-sm font-medium transition-colors"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Organizations
            </Link>
            <AdminPageHeader
              variant="compact"
              title={org.name}
              subtitle="Manage this organization's plan, listings, and support."
              badge={
                org.plan?.name ? (
                  <Badge variant="secondary">{org.plan.name}</Badge>
                ) : (
                  <Badge variant="outline">No plan</Badge>
                )
              }
              actions={
                <Button asChild variant="outline" className="min-h-[44px] gap-1.5">
                  <a href={orgDashboardPath(orgSlug)} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    Open dashboard
                  </a>
                </Button>
              }
            />
          </div>
        }
      >
        <SuperAdminOrgHubSection id="overview" title="Overview" icon={LayoutDashboard}>
          <SuperAdminOrgOverviewSection />
        </SuperAdminOrgHubSection>
        <SuperAdminOrgHubSection id="subscription" title="Subscription" icon={CreditCard}>
          <SuperAdminOrgSubscriptionSection />
        </SuperAdminOrgHubSection>
        <SuperAdminOrgHubSection id="listings" title="Listings" icon={Building2}>
          <SuperAdminOrgListingsSection />
        </SuperAdminOrgHubSection>
        <SuperAdminOrgHubSection id="approvals" title="Approvals" icon={BadgeCheck}>
          <SuperAdminOrgApprovalsSection />
        </SuperAdminOrgHubSection>
        <SuperAdminOrgHubSection id="ai" title="AI credits" icon={Sparkles}>
          <SuperAdminOrgAiSection />
        </SuperAdminOrgHubSection>
        <SuperAdminOrgHubSection id="support" title="Support" icon={LifeBuoy}>
          <SuperAdminOrgSupportSection />
        </SuperAdminOrgHubSection>
        <SuperAdminOrgHubSection id="activity" title="Activity" icon={ScrollText}>
          <SuperAdminOrgActivitySection />
        </SuperAdminOrgHubSection>
        <SuperAdminOrgHubSection id="settings" title="Settings" icon={Settings}>
          <SuperAdminOrgSettingsSection />
        </SuperAdminOrgHubSection>
      </AdminSectionNavLayout>
    </SuperAdminOrgContext.Provider>
  );
}
