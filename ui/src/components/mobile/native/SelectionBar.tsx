import { cn } from '@/lib/utils';

type SelectionBarAction = {
  key: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
};

type SelectionBarProps = {
  countLabel: string;
  actions: SelectionBarAction[];
  onClear?: () => void;
  className?: string;
};

/** Contextual bar for multi-select (calendar nights, bulk rows). */
export function SelectionBar({ countLabel, actions, onClear, className }: SelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Selection"
      className={cn(
        'border-hairline bg-card/95 safe-bottom fixed inset-x-0 bottom-[var(--mobile-bottom-bar-h,0px)] z-40',
        'flex min-h-14 items-center gap-2 border-t px-3 py-2 backdrop-blur-sm lg:hidden',
        className
      )}
    >
      <p className="text-foreground min-w-0 flex-1 truncate text-[13px] font-semibold">
        {countLabel}
      </p>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="text-muted-foreground native-v3-press min-h-11 shrink-0 px-2 text-[13px] font-medium"
        >
          Clear
        </button>
      ) : null}
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          className={cn(
            'native-v3-press min-h-11 shrink-0 rounded-full px-3 text-[13px] font-semibold',
            action.primary
              ? 'bg-primary-strong text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
