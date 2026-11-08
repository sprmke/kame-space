import { lazy, Suspense } from 'react';

import { Link, Outlet, useLocation } from 'react-router-dom';

import { MarketingBrandLogo } from '@/features/guest/marketing/shared/components/MarketingBrandLogo';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { platformCopyrightLine } from '@/lib/platformBranding';

// Pulls in Remotion (video tour rendering) — this shell is imported eagerly by the
// guest auth route tree, so keep the heavy player out of the main bundle.
const HostWorkspaceSidePanel = lazy(() =>
  import('@/features/guest/marketing/shared/components/HostWorkspaceSidePanel').then((m) => ({
    default: m.HostWorkspaceSidePanel,
  }))
);

// Guest showcase pulls in framer-motion scenes; load it beside the page, not in the shell.
const GuestExperienceSidePanel = lazy(() =>
  import('@/features/guest/auth/components/GuestExperienceSidePanel').then((m) => ({
    default: m.GuestExperienceSidePanel,
  }))
);
const GuestExperienceMobileSection = lazy(() =>
  import('@/features/guest/auth/components/GuestExperienceSidePanel').then((m) => ({
    default: m.GuestExperienceMobileSection,
  }))
);

const HOST_AUTH_PREFIX = '/for-hosts/';

/**
 * Auth shell. The logo is a plain link: guest auth is already guest mode, so it needs no
 * mode-switch curtain, and host auth stays inside host mode.
 */
export function AuthLayout() {
  const { pathname } = useLocation();
  const isHostMode = pathname.startsWith(HOST_AUTH_PREFIX);

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      {isHostMode ? (
        <Suspense fallback={<div className="hidden lg:block" />}>
          <HostWorkspaceSidePanel variant="auth" />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="bg-primary-strong hidden min-h-screen lg:block" />}>
          <GuestExperienceSidePanel />
        </Suspense>
      )}

      <div className="bg-background flex min-h-screen flex-col">
        <div className="flex items-center justify-between border-b p-4 lg:hidden">
          <Link to={isHostMode ? '/for-hosts' : '/'} className="flex min-h-[44px] items-center">
            <MarketingBrandLogo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="hidden justify-end p-6 lg:flex">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-start justify-center p-6 sm:items-center sm:p-8">
          <div className="w-full max-w-[420px]">
            <Outlet />
          </div>
        </div>

        {isHostMode ? null : (
          <Suspense fallback={null}>
            <GuestExperienceMobileSection />
          </Suspense>
        )}

        <div className="text-muted-foreground p-4 text-center text-sm lg:hidden">
          <p>{platformCopyrightLine()}</p>
        </div>
      </div>
    </div>
  );
}
