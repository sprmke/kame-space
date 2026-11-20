import { lazy, Suspense } from 'react';

import { Route } from 'react-router-dom';

const NativeKitGalleryPage = lazy(() =>
  import('@/features/dev/pages/NativeKitGalleryPage').then((m) => ({
    default: m.NativeKitGalleryPage,
  }))
);

/**
 * Dev-only routes. Gated with `import.meta.env.DEV` at the AppRoutes call site
 * so production builds drop this branch.
 */
export const devRoutes = (
  <Route
    key="dev-native-kit"
    path="/dev/native-kit"
    element={
      <Suspense fallback={null}>
        <NativeKitGalleryPage />
      </Suspense>
    }
  />
);
