import { type ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { MarketingBrandLogo } from '@/features/guest/marketing/shared/components/MarketingBrandLogo';

import { cn } from '@/lib/utils';

export interface AuthSidePanelShellProps {
  title: ReactNode;
  description: string;
  /** Accessible name for the `aside` landmark. */
  ariaLabel: string;
  logoHref: string;
  className?: string;
  children: ReactNode;
}

/**
 * Left panel chrome shared by host and guest auth (and host onboarding): solid brand surface,
 * logo inset top-left (same spot as `MarketingNav`), left-aligned heading, then the audience
 * specific showcase. Keep audience differences inside `children` only.
 */
export function AuthSidePanelShell({
  title,
  description,
  ariaLabel,
  logoHref,
  className,
  children,
}: AuthSidePanelShellProps) {
  return (
    <aside
      className={cn('bg-primary-strong relative hidden min-h-screen flex-col lg:flex', className)}
      aria-label={ariaLabel}
    >
      <Link
        to={logoHref}
        className="group absolute left-4 top-4 z-20 min-h-[44px] rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80"
      >
        <MarketingBrandLogo
          tone="onPrimary"
          className="transition-opacity group-hover:opacity-90"
        />
      </Link>

      <div className="relative z-10 flex min-h-screen flex-1 flex-col justify-center px-6 pb-10 pt-20 xl:px-10 xl:pb-12">
        <div className="mx-auto w-full max-w-xl space-y-6 xl:space-y-7">
          <div className="space-y-2">
            <h1 className="text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl xl:text-3xl">
              {title}
            </h1>
            <p className="text-base leading-relaxed text-white sm:text-lg">{description}</p>
          </div>

          {children}
        </div>
      </div>
    </aside>
  );
}
