import {
  humanizeProfileCode,
  SOURCE_LABEL,
  type AiLimitSource,
} from '@/features/dashboard/super-admin/lib/aiLimits';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type AiProvenanceBadgeProps = {
  source: AiLimitSource;
  profileCode?: string | null;
  className?: string;
};

/** Where a resolved number came from. Overrides are highlighted so leftovers stand out. */
export function AiProvenanceBadge({ source, profileCode, className }: AiProvenanceBadgeProps) {
  const usesProfileName =
    profileCode && source !== 'override' && source !== 'global' && source !== 'plan_allowance';
  const label = usesProfileName ? humanizeProfileCode(profileCode) : SOURCE_LABEL[source];
  return (
    <Badge
      variant="outline"
      className={cn(
        'max-w-full truncate text-[11px] font-medium',
        source === 'override'
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100'
          : 'bg-secondary text-secondary-foreground border-transparent',
        className
      )}
      title={profileCode && usesProfileName ? `${SOURCE_LABEL[source]} (${profileCode})` : SOURCE_LABEL[source]}
    >
      {label}
    </Badge>
  );
}
