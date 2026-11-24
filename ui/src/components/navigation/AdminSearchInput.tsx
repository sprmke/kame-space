import { useEffect, useState } from 'react';

import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';


type Props = {
  /** Current URL value. Re-syncs the field on back/forward navigation. */
  value: string;
  /** Called after the operator stops typing (300ms) and immediately on clear. */
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
  debounceMs?: number;
};

/**
 * Admin list search: local state, debounced URL write, and a clear control.
 *
 * Writing the URL per keystroke used to fire one edge request per character on every
 * super-admin list. The field stays responsive while the query waits.
 */
export function AdminSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  inputClassName,
  debounceMs = 300,
}: Props) {
  const [query, setQuery] = useState(value);
  const debounced = useDebouncedValue(query, debounceMs);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // `onChange` is intentionally excluded: callers recreate it per render and the
    // debounced value is the only thing that should trigger a URL write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className={cn('relative w-full min-w-0 flex-none sm:w-auto sm:flex-1 sm:max-w-xs', className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn('h-10 pl-9', query ? 'pr-9' : undefined, inputClassName)}
      />
      {query ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          onClick={() => {
            setQuery('');
            onChange('');
          }}
          className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 size-8 -translate-y-1/2"
        >
          <X className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
