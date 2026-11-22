import { cn } from '@/lib/utils';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  value: T;
  options: Array<Option<T>>;
  onChange: (value: T) => void;
};

/** One tap per choice instead of a dropdown: the phone way to pick from a short list. */
export function ChoiceChips<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="space-y-1.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'public-chip shrink-0 touch-manipulation rounded-full border font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-foreground hover:bg-muted'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
