import { Check } from 'lucide-react';

import type { OrgVerificationStatus } from '@/features/dashboard/org/lib/orgVerification';
import {
  type OrgVerificationRejectionKind,
  type VerificationTierDefinition,
  verificationStatusLabel,
} from '@/features/dashboard/org/lib/orgVerificationTiers';

import { cn } from '@/lib/utils';

type Props = {
  tiers: VerificationTierDefinition[];
  activeStep: number;
  onStepChange: (index: number) => void;
  hostRejectionKind?: OrgVerificationRejectionKind | null;
  verifiedRejectionKind?: OrgVerificationRejectionKind | null;
};

function rejectionKindFor(
  tier: VerificationTierDefinition,
  hostKind: OrgVerificationRejectionKind | null | undefined,
  verifiedKind: OrgVerificationRejectionKind | null | undefined
): OrgVerificationRejectionKind | null {
  if (tier.status !== 'rejected') return null;
  return tier.level === 1 ? (hostKind ?? null) : (verifiedKind ?? null);
}

/** Suggested initial step when the modal opens. */
export function defaultVerificationStepIndex(tiers: VerificationTierDefinition[]): number {
  const host = tiers[0];
  const verified = tiers[1];
  if (!host || !verified) return 0;

  if (host.status === 'rejected') return 0;
  if (verified.status === 'rejected') return 1;
  if (verified.status === 'none') return 1;
  if (host.status === 'pending') return 0;
  if (verified.status === 'pending') return 1;
  if (host.status === 'none') return 0;
  return 1;
}

function statusDotClass(status: OrgVerificationStatus, changesRequested: boolean): string {
  if (status === 'approved') return 'bg-emerald-500';
  if (status === 'pending' || changesRequested) return 'bg-amber-500';
  if (status === 'rejected') return 'bg-destructive';
  return 'bg-muted-foreground/40';
}

function statusTextClass(status: OrgVerificationStatus, changesRequested: boolean): string {
  if (status === 'approved') return 'text-emerald-700 dark:text-emerald-400';
  if (status === 'pending' || changesRequested) return 'text-amber-700 dark:text-amber-400';
  if (status === 'rejected') return 'text-destructive';
  return 'text-muted-foreground';
}

function TierLevelMark({ level, approved }: { level: number; approved: boolean }) {
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
        approved
          ? 'border-emerald-600 bg-emerald-600 text-white'
          : 'border-border bg-background text-muted-foreground'
      )}
      aria-hidden
    >
      {approved ? <Check className="size-3" strokeWidth={3} /> : level}
    </span>
  );
}

/**
 * Compact tier switcher. One tier panel shows at a time, so status lives here once
 * (dot + short label) instead of being repeated on a full-height card per tier.
 */
export function VerificationTierProgress({
  tiers,
  activeStep,
  onStepChange,
  hostRejectionKind = null,
  verifiedRejectionKind = null,
}: Props) {
  return (
    <nav aria-label="Verification tiers" className="w-full">
      <ol className="grid grid-cols-2 gap-2">
        {tiers.map((tier, index) => {
          const selected = index === activeStep;
          const approved = tier.status === 'approved';
          const kind = rejectionKindFor(tier, hostRejectionKind, verifiedRejectionKind);
          const changesRequested = tier.status === 'rejected' && kind === 'changes';

          return (
            <li key={tier.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onStepChange(index)}
                aria-current={selected ? 'step' : undefined}
                className={cn(
                  'flex min-h-[52px] w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors',
                  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  selected
                    ? 'border-primary/50 bg-primary/[0.06] ring-primary/20 ring-1'
                    : 'border-border bg-muted/20 hover:bg-muted/40'
                )}
              >
                <TierLevelMark level={tier.level} approved={approved} />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-[13px] font-semibold leading-tight">
                    {tier.title}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1">
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        statusDotClass(tier.status, changesRequested)
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'truncate text-[11px] leading-none',
                        statusTextClass(tier.status, changesRequested)
                      )}
                    >
                      {verificationStatusLabel(tier.status, kind)}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
