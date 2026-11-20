import { cn } from '@/lib/utils';

type NextActionCardProps = {
  title: string;
  context?: string;
  actionLabel: string;
  onAction: () => void;
  className?: string;
};

/** Title, one line of context, one primary button. */
export function NextActionCard({
  title,
  context,
  actionLabel,
  onAction,
  className,
}: NextActionCardProps) {
  return (
    <div className={cn('border-hairline bg-tint rounded-native-card border p-4', className)}>
      <p className="text-native-label text-tint-foreground">Next action</p>
      <p className="text-native-row text-foreground mt-1">{title}</p>
      {context ? <p className="text-native-meta mt-1">{context}</p> : null}
      <button
        type="button"
        onClick={onAction}
        className="native-v3-press bg-primary-strong text-primary-foreground text-native-button rounded-native-control mt-3 inline-flex h-12 w-full items-center justify-center"
      >
        {actionLabel}
      </button>
    </div>
  );
}
