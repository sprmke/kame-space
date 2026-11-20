import { Routes } from 'react-router-dom';

import { guestRoutes } from '@/features/guest/routes';

import { dashboardRoutes } from '@/features/dashboard/routes';

import { devRoutes } from '@/features/dev/routes';
import { launchRoutes } from '@/features/launch/routes';
import { verificationRoutes } from '@/features/verification/routes';


export function AppRoutes() {
  return (
    <Routes>
      {/* `/app` first: the installed-app launch resolver, valid for every audience. */}
      {launchRoutes}
      {/* Dev kit gallery — tree-shaken when `import.meta.env.DEV` is false. */}
      {import.meta.env.DEV ? devRoutes : null}
      {guestRoutes}
      {dashboardRoutes}
      {/* Standalone phone handoff — outside every layout on purpose. */}
      {verificationRoutes}
    </Routes>
  );
}
