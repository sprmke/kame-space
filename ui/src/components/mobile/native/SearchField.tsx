import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
};

/** 44px search with tint fill and clear button. */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  className,
  'aria-label': ariaLabel = 'Search',
}: SearchFieldProps) {
  return (
    <label
      className={cn(
        'bg-tint text-tint-foreground rounded-native-control relative flex h-11 items-center gap-2 px-3',
        className
      )}
    >
      <Search className="size-5 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        enterKeyHint="search"
        className="text-native-body text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="native-v3-press inline-flex size-8 items-center justify-center rounded-full"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      ) : null}
    </label>
  );
}
