import type { ComponentType } from 'react';

import { cn } from '@/lib/utils';

type IconTileProps = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  className?: string;
  /** Decorative; parent should provide the accessible name. */
  'aria-hidden'?: boolean;
};

/** 36px tint tile with a 20px lucide icon (stroke 1.75). */
export function IconTile({
  icon: Icon,
  className,
  'aria-hidden': ariaHidden = true,
}: IconTileProps) {
  return (
    <span
      aria-hidden={ariaHidden}
      className={cn(
        'bg-tint text-tint-foreground rounded-native-control inline-flex size-9 shrink-0 items-center justify-center',
        className
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
  );
}
