import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  /**
   * Drop the own border when this row sits inside a parent card (Manage sheet
   * Activity block: master + preferences + quiet hours share one surface).
   */
  embedded?: boolean;
  /** Surface overrides, e.g. `bg-card` when the row sits on a page card. */
  className?: string;
  /** Description tone, e.g. `text-destructive` for "this browser can't do it". */
  descriptionClassName?: string;
};

/**
 * One bordered master control for a delivery channel (this device, Telegram).
 * Activity and Telegram use the same row so the two tabs read as one page.
 */
export function NotificationMasterSwitchRow({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
  embedded = false,
  className,
  descriptionClassName,
}: Props) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-3 sm:px-4',
        /* Standalone: own card. Embedded: parent owns the border. */
        !embedded && 'border-border bg-card rounded-xl border',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-[13px] font-semibold leading-tight sm:text-sm">
            {title}
          </p>
          <p className={cn('text-card-description mt-0.5', descriptionClassName)}>{description}</p>
        </div>
      </div>
      <Switch
        aria-label={title}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
