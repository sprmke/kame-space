import { SuperAdminRecordNotFound } from '@/features/dashboard/super-admin/components/shared/SuperAdminRecordNotFound';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { appPageTitle, usePageTitle } from '@/lib/pageTitle';

/**
 * Unknown `/admin/*` URL. Stays inside the console so the operator keeps the
 * sidebar and a route back, instead of falling through to the public 404.
 */
export function SuperAdminNotFoundPage() {
  usePageTitle(appPageTitle('Page not found'));

  return (
    <SuperAdminRecordNotFound
      title="Page not found"
      description="That address does not match any console page."
      backTo={superAdminPaths.root}
      backLabel="Back to Overview"
    />
  );
}
