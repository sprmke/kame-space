import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ChevronLeft, MoreHorizontal, X } from 'lucide-react';

import { ActionPill } from '@/components/mobile/native/ActionPill';
import { KameButton } from '@/components/mobile/native/KameButton';
import type { PillTone } from '@/components/mobile/native/pillTone';
import { ScopeChip } from '@/components/mobile/native/ScopeChip';
import { StatusPill } from '@/components/mobile/native/StatusPill';
import { StepperHeader } from '@/components/mobile/native/StepperHeader';
import {
  compactTitleStyle,
  largeTitleStyle,
  titleCollapseFromRatio,
} from '@/components/mobile/native/titleCollapse';
import { cn } from '@/lib/utils';

type ScopeChipProps = {
  name: string;
  parentLine?: string;
  photoUrl?: string | null;
  parking?: boolean;
  onClick?: () => void;
};

type AppBarRootProps = {
  variant: 'root';
  title: string;
  titleId?: string;
  /** Structured scope chip. Ignored when `scopeSlot` is set. */
  scope?: ScopeChipProps;
  /**
   * Escape hatch for the existing tenant switcher during Phase 2 migration.
   * Prefer `scope` + WorkspaceSwitcherSheet once that sheet lands.
   */
  scopeSlot?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onMore?: () => void;
  /** Free-form trailing next to the action pill (legacy heroTrailing migration). */
  trailing?: ReactNode;
  onAskKame?: () => void;
  askKameLabelled?: boolean;
  hideKame?: boolean;
  className?: string;
};

type AppBarDetailProps = {
  variant: 'detail';
  title: string;
  titleId?: string;
  subtitle?: string;
  onBack: () => void;
  status?: { tone: PillTone; label: string };
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

type AppBarFlowProps = {
  variant: 'flow';
  title: string;
  titleId?: string;
  onClose?: () => void;
  onBack?: () => void;
  step: number;
  total: number;
  stepLabel: string;
  className?: string;
};

export type AppBarProps = AppBarRootProps | AppBarDetailProps | AppBarFlowProps;

/**
 * Brand app bar (v3). Renders the only `h1` for the screen.
 * Large → compact title uses IntersectionObserver + opacity only (no layout animation).
 * Not wired into AdminLayout until Phase 2.
 */
export function AppBar(props: AppBarProps) {
  if (props.variant === 'detail') return <AppBarDetail {...props} />;
  if (props.variant === 'flow') return <AppBarFlow {...props} />;
  return <AppBarRoot {...props} />;
}

function AppBarBand({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        'bg-appbar text-appbar-foreground lg:hidden',
        'pt-[max(0.5rem,var(--safe-top))]',
        className
      )}
    >
      {children}
    </header>
  );
}

function AppBarRoot({
  title,
  titleId = 'native-appbar-title',
  scope,
  scopeSlot,
  actionLabel,
  onAction,
  onMore,
  trailing,
  onAskKame,
  askKameLabelled = false,
  hideKame = false,
  className,
}: AppBarRootProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = titleRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setProgress(titleCollapseFromRatio(entry.intersectionRatio).progress);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-8px 0px 0px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const large = largeTitleStyle(progress);
  const compact = compactTitleStyle(progress);
  const scopeNode = scopeSlot ?? (scope ? <ScopeChip {...scope} /> : null);

  return (
    <AppBarBand className={className}>
      <div className="flex h-12 items-center justify-between gap-2 px-4">
        <div className="min-w-0 flex-1">{scopeNode}</div>
        {!hideKame ? <KameButton onClick={onAskKame} labelled={askKameLabelled} /> : null}
      </div>
      <div className="relative flex min-h-12 items-end justify-between gap-2 px-4 pb-5">
        <h1
          ref={titleRef}
          id={titleId}
          className="text-native-large-title text-appbar-foreground min-w-0 flex-1 truncate"
          style={large}
        >
          {title}
        </h1>
        <div className="flex shrink-0 items-center gap-1 pb-0.5">
          {actionLabel && onAction ? (
            <ActionPill onClick={onAction}>{actionLabel}</ActionPill>
          ) : null}
          {trailing}
          {onMore ? (
            <button
              type="button"
              onClick={onMore}
              aria-label="More actions"
              className="native-v3-press bg-appbar-control inline-flex size-11 items-center justify-center rounded-full"
            >
              <MoreHorizontal className="size-5" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
        <span
          aria-hidden
          className="text-native-compact-title text-appbar-foreground pointer-events-none absolute inset-x-4 top-0 flex h-12 items-center"
          style={compact}
        >
          {title}
        </span>
      </div>
    </AppBarBand>
  );
}

function AppBarDetail({
  title,
  titleId = 'native-appbar-title',
  subtitle,
  onBack,
  status,
  actionLabel,
  onAction,
  className,
}: AppBarDetailProps) {
  return (
    <AppBarBand className={cn('pb-2', className)}>
      <div className="flex h-14 items-center gap-1 px-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="native-v3-press inline-flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <ChevronLeft className="size-6" strokeWidth={1.75} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 id={titleId} className="text-native-compact-title truncate">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-appbar-muted truncate text-[12px] leading-4">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex min-w-11 shrink-0 justify-end pr-1">
          {status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : null}
          {!status && actionLabel && onAction ? (
            <ActionPill onClick={onAction}>{actionLabel}</ActionPill>
          ) : null}
        </div>
      </div>
    </AppBarBand>
  );
}

function AppBarFlow({
  title,
  titleId = 'native-appbar-title',
  onClose,
  onBack,
  step,
  total,
  stepLabel,
  className,
}: AppBarFlowProps) {
  const handleLeading = onClose ?? onBack;
  return (
    <AppBarBand className={className}>
      <div className="flex h-14 items-center gap-1 px-2">
        {handleLeading ? (
          <button
            type="button"
            onClick={handleLeading}
            aria-label={onClose ? 'Close' : 'Back'}
            className="native-v3-press inline-flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            {onClose ? (
              <X className="size-5" strokeWidth={1.75} />
            ) : (
              <ChevronLeft className="size-6" strokeWidth={1.75} />
            )}
          </button>
        ) : (
          <span className="size-11" />
        )}
        <h1 id={titleId} className="text-native-compact-title min-w-0 flex-1 truncate text-center">
          {title}
        </h1>
        <span className="size-11" />
      </div>
      <StepperHeader step={step} total={total} label={stepLabel} />
    </AppBarBand>
  );
}
