import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type ContentSheetProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Paper content that overlaps the brand app bar with 24px top corners.
 * Place immediately after `AppBar` on root screens.
 */
export function ContentSheet({ children, className }: ContentSheetProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-native-sheet relative z-[1] -mt-4 min-h-[50vh] px-4 pb-6 pt-4',
        className
      )}
    >
      {children}
    </div>
  );
}
