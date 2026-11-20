import { type PillTone, PILL_TONE_CLASS } from '@/components/mobile/native/pillTone';
import { cn } from '@/lib/utils';

type StatusPillProps = {
  tone: PillTone;
  children: React.ReactNode;
  className?: string;
};

/** Five-tone status pill. Never rely on color alone; keep a text label. */
export function StatusPill({ tone, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'text-native-pill inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5',
        PILL_TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
