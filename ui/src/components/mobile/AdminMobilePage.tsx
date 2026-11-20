import type { ReactNode } from 'react';

import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';

import { MobilePageStack } from '@/components/mobile/FloatingPanel';
import { HeroTenantScope } from '@/components/mobile/HeroTenantScope';
import { useAdminNativeChrome } from '@/components/mobile/native/AdminNativeChromeContext';
import { AppBar } from '@/components/mobile/native/AppBar';
import { ContentSheet } from '@/components/mobile/native/ContentSheet';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type AdminMobilePageProps = {
  title: string;
  subtitle?: string;
  titleId?: string;
  /** Optional plan/status pill next to the title (e.g. `<TierBadge>`). */
  badge?: ReactNode;
  /** Optional helper control rendered immediately after the title. */
  titleHint?: ReactNode;
  heroTrailing?: ReactNode;
  overlap?: ReactNode;
  /** Compact sticky row — defaults to overlap when omitted. Kept for call-site compat. */
  stickyPrimary?: ReactNode;
  /** Secondary sticky controls — kept for call-site compat. */
  stickyMore?: ReactNode;
  stickyMoreActiveCount?: number;
  stickyMoreAriaLabel?: string;
  desktopActions?: ReactNode;
  desktopActionsClassName?: string;
  superAdmin?: boolean;
  dense?: boolean;
  /**
   * When true on phone, skip the root AppBar and content sheet so a nested
   * detail surface (e.g. inbox thread) can own the chrome.
   */
  hideMobileChrome?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Native mobile page shell (v3). Phone uses the brand `AppBar` + content sheet;
 * desktop keeps `AdminPageHeader`.
 */
export function AdminMobilePage({
  title,
  subtitle,
  titleId,
  badge,
  titleHint,
  heroTrailing,
  overlap,
  stickyPrimary: _stickyPrimary,
  stickyMore: _stickyMore,
  stickyMoreActiveCount: _stickyMoreActiveCount,
  stickyMoreAriaLabel: _stickyMoreAriaLabel,
  desktopActions,
  desktopActionsClassName,
  superAdmin = false,
  dense = false,
  hideMobileChrome = false,
  className,
  children,
}: AdminMobilePageProps) {
  const isMobileLayout = useIsBelowLg();
  const { onAskKame, hideKame, askKameLabelled } = useAdminNativeChrome();
  const showMobileChrome = isMobileLayout && !hideMobileChrome;

  return (
    <div data-admin-mobile-page className={cn('flex min-h-0 w-full flex-1 flex-col')}>
      {showMobileChrome ? (
        <AppBar
          variant="root"
          title={title}
          titleId={titleId}
          scopeSlot={<HeroTenantScope superAdmin={superAdmin} />}
          trailing={heroTrailing}
          onAskKame={onAskKame}
          hideKame={hideKame || superAdmin}
          askKameLabelled={askKameLabelled}
        />
      ) : null}

      <div className={cn('bg-canvas relative z-0 flex min-h-0 min-w-0 flex-1 flex-col')}>
        {showMobileChrome ? (
          <ContentSheet className={cn('flex min-h-0 flex-1 flex-col', className)}>
            {badge || titleHint ? (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {badge}
                {titleHint}
              </div>
            ) : null}
            {overlap ? (
              <div className="sticky top-0 z-10 -mx-4 mb-3 bg-card/95 px-4 pb-2 pt-1 backdrop-blur-sm">
                {overlap}
              </div>
            ) : null}
            <MobilePageStack dense={dense} className="min-h-0 flex-1">
              {children}
            </MobilePageStack>
          </ContentSheet>
        ) : isMobileLayout ? (
          <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{children}</div>
        ) : (
          <MobilePageStack dense={dense} className={cn('min-h-0 flex-1 px-4 md:px-6', className)}>
            <div className="hidden shrink-0 lg:block">
              <AdminPageHeader
                id={titleId}
                variant="compact"
                card={false}
                title={title}
                subtitle={subtitle}
                badge={badge}
                titleHint={titleHint}
                actions={desktopActions}
                actionsClassName={desktopActionsClassName}
              />
            </div>
            {children}
          </MobilePageStack>
        )}
      </div>
    </div>
  );
}
