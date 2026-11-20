import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

type CheckRowProps = {
  title: string;
  meta?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
  className?: string;
};

/** Check circle completes a row (optimistic + undo at the call site). */
export function CheckRow({
  title,
  meta,
  checked,
  onToggle,
  disabled = false,
  trailing,
  className,
}: CheckRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
      className={cn(
        'native-v3-press border-hairline flex min-h-14 w-full items-center gap-3 border-b px-3 py-2.5 text-left',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
    >
      <span
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2',
          checked
            ? 'border-primary-strong bg-primary-strong text-primary-foreground'
            : 'border-muted-foreground/40 bg-transparent'
        )}
        aria-hidden
      >
        {checked ? <Check className="size-4" strokeWidth={2.5} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'text-foreground block truncate text-[15px] font-medium leading-tight',
            checked && 'text-muted-foreground line-through'
          )}
        >
          {title}
        </span>
        {meta ? (
          <span className="text-muted-foreground mt-0.5 block truncate text-[12px] leading-tight">
            {meta}
          </span>
        ) : null}
      </span>
      {trailing}
    </button>
  );
}
