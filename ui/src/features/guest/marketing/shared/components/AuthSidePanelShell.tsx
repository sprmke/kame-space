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
 * logo in `.public-brand-bar` (same height + left inset as `MarketingNav` / `--public-shell-px`),
 * then a max-width content column (headline + showcase). Keep audience differences in
 * `children` only.
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
      {/* Logo stays nav-aligned top-left; content below is free to center independently. */}
      <div className="public-brand-bar absolute inset-x-0 top-0 z-20">
        <Link
          to={logoHref}
          className="group flex min-h-[44px] items-center rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80"
        >
          <MarketingBrandLogo
            tone="onPrimary"
            className="transition-opacity group-hover:opacity-90"
          />
        </Link>
      </div>

      {/*
        Gutter matches `.public-brand-bar` (`--public-shell-px`). The max-w-xl column uses
        `mx-auto` so it sits flush with that gutter when the half-panel is tight (lg), and
        centers in the green panel when the half-panel is wider than the column (xl+).
        Copy stays left-aligned inside the column.
      */}
      <div className="relative z-10 flex min-h-screen flex-1 flex-col justify-center px-[var(--public-shell-px)] pb-10 pt-[var(--public-nav-h)] xl:pb-12">
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
