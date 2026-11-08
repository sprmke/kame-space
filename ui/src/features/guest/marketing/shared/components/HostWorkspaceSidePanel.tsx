import { type ReactNode } from 'react';

import { HostDashboardTourPlayer } from '@/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer';
import { AuthSidePanelShell } from '@/features/guest/marketing/shared/components/AuthSidePanelShell';

export type HostWorkspaceSidePanelVariant = 'auth' | 'onboarding';

interface HostWorkspaceSidePanelContent {
  title: ReactNode;
  description: string;
  tourRegionLabel: string;
}

const HOST_WORKSPACE_SIDE_PANEL_CONTENT: Record<
  HostWorkspaceSidePanelVariant,
  HostWorkspaceSidePanelContent
> = {
  auth: {
    title: 'Property management made simple',
    description: 'All the tools you need to manage your property in one workspace.',
    tourRegionLabel: 'Interactive preview of host features',
  },
  onboarding: {
    title: 'See workspace in action',
    description: 'Watch all the features available to you as a host',
    tourRegionLabel: 'Interactive preview of host features',
  },
};

export interface HostWorkspaceSidePanelProps {
  variant: HostWorkspaceSidePanelVariant;
  className?: string;
}

export function HostWorkspaceSidePanel({ variant, className }: HostWorkspaceSidePanelProps) {
  const content = HOST_WORKSPACE_SIDE_PANEL_CONTENT[variant];

  return (
    <AuthSidePanelShell
      title={content.title}
      description={content.description}
      ariaLabel="Host workspace preview"
      logoHref="/for-hosts"
      className={className}
    >
      <HostDashboardTourPlayer variant="compact" regionLabel={content.tourRegionLabel} />
    </AuthSidePanelShell>
  );
}
