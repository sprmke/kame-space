import { BrandEmptyState } from '@/components/branding/BrandEmptyState';
import { FeatureAvailabilityReasonIcon } from '@/components/feature-availability/FeatureAvailabilityReasonIcon';
import { featureAvailabilityReasonIcon } from '@/lib/featureAvailability/featureAvailabilityCopy';
import type { FeatureAvailabilityTone } from '@/lib/featureAvailability/featureAvailabilityCopy';
import type { FeatureAvailabilityReason } from '@/lib/featureAvailability/featureAvailabilityCatalog';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  message: string;
  expectedBackLabel?: string | null;
  reason?: FeatureAvailabilityReason | null;
  tone?: FeatureAvailabilityTone;
  className?: string;
  compact?: boolean;
};

export function FeatureUnavailablePanel({
  label,
  message,
  expectedBackLabel,
  reason = null,
  tone = 'neutral',
  className,
  compact = false,
}: Props) {
  const iconName = featureAvailabilityReasonIcon(reason);
  const isAmber = tone === 'amber';

  if (!compact) {
    return (
      <div role="status" className={className}>
        <BrandEmptyState
          markSize="md"
          title={label}
          description={message}
          className="py-8 sm:py-10"
        >
          {expectedBackLabel ? (
            <p className="text-muted-foreground text-sm">{expectedBackLabel}</p>
          ) : null}
        </BrandEmptyState>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn('flex flex-col items-center gap-2 px-2 py-3 text-center', className)}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full',
          isAmber
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <FeatureAvailabilityReasonIcon name={iconName} className="h-5 w-5" />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-muted-foreground text-xs">{message}</p>
        {expectedBackLabel ? (
          <p className="text-muted-foreground text-xs">{expectedBackLabel}</p>
        ) : null}
      </div>
    </div>
  );
}
