import { cn } from '@/lib/utils';

type StepperHeaderProps = {
  step: number;
  total: number;
  label: string;
  className?: string;
};

/** "2 of 3 · Vehicle" with a dot track under the flow app bar. */
export function StepperHeader({ step, total, label, className }: StepperHeaderProps) {
  const safeTotal = Math.max(1, total);
  const safeStep = Math.min(Math.max(1, step), safeTotal);

  return (
    <div className={cn('px-4 pb-2', className)}>
      <p className="text-appbar-muted text-native-meta">
        {safeStep} of {safeTotal} · {label}
      </p>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {Array.from({ length: safeTotal }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full',
              i < safeStep ? 'bg-appbar-foreground' : 'bg-appbar-control'
            )}
          />
        ))}
      </div>
    </div>
  );
}
