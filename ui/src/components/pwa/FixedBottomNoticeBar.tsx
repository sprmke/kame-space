import { useLayoutEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type FixedBottomNoticeBarProps = {
  /** Overlay positioning class (`.cookie-consent-overlay` or `.pwa-bottom-notice-overlay`). */
  overlayClassName: string;
  /** When set, publishes the bar height to this CSS var for stacking siblings above it. */
  heightCssVar?: string;
  role?: 'region' | 'status';
  'aria-label'?: string;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  children: ReactNode;
  className?: string;
};

/**
 * Shared flush bottom notice chrome (cookie consent, install offer, update prompt).
 * Full-width edge-to-edge bar; overlays handle dock clearance, dashboard rail inset,
 * and stacking via `--cookie-consent-h`.
 */
export function FixedBottomNoticeBar({
  overlayClassName,
  heightCssVar,
  role = 'status',
  'aria-label': ariaLabel,
  'aria-live': ariaLive,
  children,
  className,
}: FixedBottomNoticeBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!heightCssVar) return;
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty(heightCssVar, `${el.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty(heightCssVar, '0px');
    };
  }, [heightCssVar]);

  return (
    <div className={cn(overlayClassName, 'pointer-events-none fixed')}>
      <div
        ref={barRef}
        role={role}
        aria-label={ariaLabel}
        aria-live={ariaLive}
        className={cn(
          'fixed-bottom-notice-bar border-border/70 bg-background/96 pointer-events-auto border-t',
          'supports-[backdrop-filter]:bg-background/90 backdrop-blur-xl',
          'shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.45)]',
          'flex w-full flex-row flex-wrap items-center justify-center gap-2 px-4 py-2.5',
          'sm:gap-3 sm:px-5',
          'lg:gap-4 lg:px-6 lg:py-2.5',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
