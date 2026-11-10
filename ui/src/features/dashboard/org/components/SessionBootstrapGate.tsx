import type { ReactNode } from 'react';

import { AppLoader } from '@/components/branding/AppLoader';

import { useSessionBootstrap } from '@/features/dashboard/org/hooks/useSessionBootstrap';

/**
 * One loading state for the admin shell, backed by one request.
 *
 * Before this, a cold open rendered the full-screen loader, then the org guard's loader,
 * then the property guard's, each waiting on its own round trip. This runs the bootstrap
 * once and holds the shell until it resolves, so the guards below find their query keys
 * already populated and paint immediately.
 *
 * On failure it renders the children anyway. The guards then fetch for themselves and
 * produce the same redirect or denial they always did, so a bootstrap outage degrades to
 * the old behaviour rather than locking anyone out.
 */
export function SessionBootstrapGate({ children }: { children: ReactNode }) {
  const { isPending } = useSessionBootstrap();

  if (isPending) return <AppLoader fullScreen />;

  return <>{children}</>;
}
