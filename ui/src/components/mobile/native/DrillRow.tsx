import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

type DrillRowProps = {
  title: string;
  value?: string;
  onClick: () => void;
  className?: string;
};

/** Settings-style drill: title + sub-value + chevron. */
export function DrillRow({ title, value, onClick, className }: DrillRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'native-v3-press border-hairline flex min-h-14 w-full items-center gap-3 border-b px-4 py-2.5 text-left',
        className
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="text-native-row text-foreground block truncate">{title}</span>
        {value ? <span className="text-native-meta mt-0.5 block truncate">{value}</span> : null}
      </span>
      <ChevronRight
        className="text-muted-foreground size-5 shrink-0"
        strokeWidth={1.75}
        aria-hidden
      />
    </button>
  );
}
