import { useParams } from 'react-router-dom';

import { NotificationsActivityView } from '@/features/dashboard/notifications/components/NotificationsActivityView';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';

import { AdminMobilePage } from '@/components/mobile/AdminMobilePage';
import { orgPageTitle, usePageTitle } from '@/lib/pageTitle';

/** Org-scope Alerts tab (D2): same feed as the desktop notification bell. */
export function OrgAlertsPage() {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const tenant = useOptionalOrgContext();
  const { data: orgsData } = useOrganizations();
  const orgName =
    tenant?.org?.name ?? orgsData?.organizations.find((o) => o.slug === orgSlug)?.name;
  usePageTitle(orgName ? orgPageTitle(orgName, 'Alerts') : undefined);

  return (
    <AdminMobilePage title="Alerts">
      <div className="min-h-[50vh]">
        <NotificationsActivityView />
      </div>
    </AdminMobilePage>
  );
}
