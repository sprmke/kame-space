import type { ReactNode } from 'react';

import { Navigate, useLocation } from 'react-router-dom';

import { RefreshCw, ShieldX } from 'lucide-react';

import { hostLoginPath } from '@/features/guest/auth/lib/hostAuthPaths';

import { RequireAdminSignOutButton } from '@/features/dashboard/bookings/components/RequireAdmin';
import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { SuperAdminShellSkeleton } from '@/features/dashboard/super-admin/components/SuperAdminShellSkeleton';

import { Button } from '@/components/ui/button';

type Props = {
  children: ReactNode;
};

export function RequireSuperAdmin({ children }: Props) {
  const location = useLocation();
  const { status } = useAdminSession();
  const capabilities = useOrganizations({ enabled: status === 'admin' });

  if (status === 'signed-out') {
    return <Navigate to={hostLoginPath(location.pathname + location.search)} replace />;
  }

  if (status === 'loading' || (capabilities.isLoading && !capabilities.isError)) {
    return <SuperAdminShellSkeleton />;
  }

  // A failed capability call is not a permissions decision. Retry instead of
  // sending the operator to "Access restricted" and a sign-out they do not need.
  if (capabilities.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 py-10" role="alert">
        <div className="border-border bg-card w-full max-w-[min(calc(100vw-1.5rem),24rem)] rounded-xl border p-6 text-center">
          <RefreshCw className="text-muted-foreground mx-auto mb-3 size-8" aria-hidden />
          <h1 className="text-foreground text-lg font-semibold">Could not check access</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            The console could not verify your permissions. This is usually temporary.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              className="w-full"
              onClick={() => void capabilities.refetch()}
              disabled={capabilities.isFetching}
            >
              {capabilities.isFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
          <div className="mt-3">
            <RequireAdminSignOutButton />
          </div>
        </div>
      </div>
    );
  }

  if (capabilities.data?.isSuperAdmin !== true) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-10" role="alert">
        <div className="border-border bg-card w-full max-w-[min(calc(100vw-1.5rem),24rem)] rounded-xl border p-6 text-center">
          <ShieldX className="text-muted-foreground mx-auto mb-3 size-8" aria-hidden />
          <h1 className="text-foreground text-lg font-semibold">Access restricted</h1>
          <div className="mt-6">
            <RequireAdminSignOutButton />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
