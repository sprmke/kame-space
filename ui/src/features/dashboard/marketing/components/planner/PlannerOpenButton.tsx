import { CalendarCheck2 } from 'lucide-react';

import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { cn } from '@/lib/utils';

type Props = {
  onClick: () => void;
  className?: string;
  /** `hero` = icon on the mobile brand hero; `default` = labeled page action. */
  variant?: 'default' | 'hero';
};

/** Page-level Marketing control that opens the planner modal. */
export function PlannerOpenButton({ onClick, className, variant = 'default' }: Props) {
  if (variant === 'hero') {
    return (
      <MobileHeroActionButton
        className={className}
        onClick={onClick}
        aria-label="Plan"
        aria-haspopup="dialog"
        title="Plan"
      >
        <CalendarCheck2 aria-hidden />
      </MobileHeroActionButton>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn('gap-1.5', className)}
      onClick={onClick}
      aria-haspopup="dialog"
    >
      <CalendarCheck2 className="size-3.5 shrink-0" aria-hidden />
      Plan
      <TierBadge feature="marketingPlanner" className="ml-0.5" />
    </Button>
  );
}
