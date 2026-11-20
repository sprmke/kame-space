import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type ListSectionProps = {
  title: string;
  viewAllLabel?: string;
  onViewAll?: () => void;
  children: ReactNode;
  className?: string;
};

export function ListSection({
  title,
  viewAllLabel = 'View all',
  onViewAll,
  children,
  className,
}: ListSectionProps) {
  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-native-section text-foreground">{title}</h2>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-native-meta text-primary native-v3-press min-h-11 px-1 font-medium"
          >
            {viewAllLabel}
          </button>
        ) : null}
      </div>
      <div className="border-hairline bg-card rounded-native-row overflow-hidden border">
        {children}
      </div>
    </section>
  );
}
