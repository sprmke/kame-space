import { GuestFeatureShowcase } from '@/features/guest/auth/components/GuestFeatureShowcase';
import { AuthSidePanelShell } from '@/features/guest/marketing/shared/components/AuthSidePanelShell';

import { useIsBelowLg } from '@/hooks/useMediaQuery';

export const GUEST_AUTH_PANEL_TITLE = 'Your whole stay, in one app';
export const GUEST_AUTH_PANEL_DESCRIPTION =
  'Find a place, book with the host, keep every detail in one spot.';

/** Desktop stage follows viewport height so heading + card always fit in one screen. */
const PANEL_STAGE_CLASS = 'aspect-auto sm:aspect-auto h-[clamp(240px,calc(100dvh-440px),340px)]';

/** Guest auth left panel (lg+). Same shell as the host panel; only the showcase differs. */
export function GuestExperienceSidePanel() {
  // Mount one showcase at a time so the hidden copy never animates in the background.
  const isBelowLg = useIsBelowLg();
  if (isBelowLg) return null;

  return (
    <AuthSidePanelShell
      title={GUEST_AUTH_PANEL_TITLE}
      description={GUEST_AUTH_PANEL_DESCRIPTION}
      ariaLabel="Guest features preview"
      logoHref="/"
    >
      <GuestFeatureShowcase stageClassName={PANEL_STAGE_CLASS} />
    </AuthSidePanelShell>
  );
}

/** Phone / tablet (< lg): same story under the form, since the side panel is hidden there. */
export function GuestExperienceMobileSection() {
  const isBelowLg = useIsBelowLg();
  if (!isBelowLg) return null;

  return (
    <section
      aria-labelledby="guest-auth-why-heading"
      className="border-border/70 mx-auto w-full max-w-[560px] space-y-4 border-t px-4 pb-8 pt-8 sm:px-8 lg:hidden"
    >
      <div className="space-y-1">
        <p className="public-eyebrow text-primary font-semibold">Why sign in</p>
        <h2
          id="guest-auth-why-heading"
          className="text-foreground text-xl font-bold leading-tight tracking-tight"
        >
          {GUEST_AUTH_PANEL_TITLE}
        </h2>
        <p className="text-muted-foreground text-sm">{GUEST_AUTH_PANEL_DESCRIPTION}</p>
      </div>
      <GuestFeatureShowcase />
    </section>
  );
}
