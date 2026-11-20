import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type ToggleRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  locked?: boolean;
  className?: string;
};

/** Title + sub + Switch; whole row toggles. Locked state for plan gates. */
export function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  locked = false,
  className,
}: ToggleRowProps) {
  return (
    <div
      role="group"
      className={cn(
        'border-hairline flex min-h-14 w-full items-center gap-3 border-b px-4 py-2.5',
        locked ? 'opacity-60' : 'native-v3-press',
        className
      )}
    >
      <button
        type="button"
        disabled={locked}
        onClick={() => onCheckedChange(!checked)}
        className="min-w-0 flex-1 text-left"
      >
        <span className="text-native-row text-foreground block truncate">{title}</span>
        {description ? (
          <span className="text-native-meta mt-0.5 line-clamp-2 block">{description}</span>
        ) : null}
      </button>
      <Switch
        checked={checked}
        disabled={locked}
        onCheckedChange={onCheckedChange}
        aria-label={title}
      />
    </div>
  );
}
