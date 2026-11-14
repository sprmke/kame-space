import { Suspense, lazy } from 'react';

import { Route, Routes } from 'react-router-dom';

import { guestRoutes } from '@/features/guest/routes';

import { dashboardRoutes } from '@/features/dashboard/routes';

import { launchRoutes } from '@/features/launch/routes';
import { verificationRoutes } from '@/features/verification/routes';
/** Not a string-literal `path=` on purpose: it is DEV-only and must stay out of the PWA route registry. */
const POSTER_SHEET_PATH = '/dev/poster-sheet';

/** Dev only: Vite folds `import.meta.env.DEV` to false, so this never ships. */
const PosterSheetPage = import.meta.env.DEV
  ? lazy(() =>
      import('@/features/dashboard/marketing/dev/PosterSheetPage').then((m) => ({
        default: m.PosterSheetPage,
      }))
    )
  : null;

export function AppRoutes() {
  return (
    <Routes>
      {/* `/app` first: the installed-app launch resolver, valid for every audience. */}
      {launchRoutes}
      {guestRoutes}
      {dashboardRoutes}
      {/* Standalone phone handoff — outside every layout on purpose. */}
      {verificationRoutes}
      {PosterSheetPage && (
        <Route
          path={POSTER_SHEET_PATH}
          element={
            <Suspense fallback={null}>
              <PosterSheetPage />
            </Suspense>
          }
        />
      )}
    </Routes>
  );
}
