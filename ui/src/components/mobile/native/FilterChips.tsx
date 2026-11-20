import { cn } from '@/lib/utils';

export type FilterChipItem = {
  key: string;
  label: string;
};

type FilterChipsProps = {
  items: FilterChipItem[];
  value: string | string[];
  onChange: (next: string | string[]) => void;
  multi?: boolean;
  className?: string;
};

/** Horizontal scroll chips; single or multi select. */
export function FilterChips({
  items,
  value,
  onChange,
  multi = false,
  className,
}: FilterChipsProps) {
  const selected = new Set(Array.isArray(value) ? value : [value]);

  function toggle(key: string) {
    if (!multi) {
      onChange(key);
      return;
    }
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next]);
  }

  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      {items.map((item) => {
        const active = selected.has(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => toggle(item.key)}
            aria-pressed={active}
            className={cn(
              'native-v3-press text-native-pill inline-flex h-9 shrink-0 items-center rounded-full px-3',
              active
                ? 'bg-tint text-tint-foreground'
                : 'border-hairline bg-card text-foreground border'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
