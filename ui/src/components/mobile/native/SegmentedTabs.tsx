import { cn } from '@/lib/utils';

export type SegmentedTabItem = {
  key: string;
  label: string;
  count?: number;
};

type SegmentedTabsProps = {
  items: SegmentedTabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
};

/** Pill track with 2 to 4 segments. */
export function SegmentedTabs({ items, value, onChange, className }: SegmentedTabsProps) {
  return (
    <div role="tablist" className={cn('bg-muted flex h-10 gap-1 rounded-full p-1', className)}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              'text-native-button native-v3-press flex min-h-8 min-w-0 flex-1 items-center justify-center rounded-full px-2',
              active ? 'bg-card text-foreground shadow-native-card' : 'text-muted-foreground'
            )}
          >
            <span className="truncate">
              {item.label}
              {item.count != null ? ` ${item.count}` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
