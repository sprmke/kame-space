import { cn } from '@/lib/utils';

type Props = { className?: string; iconClassName?: string };

/** Shared F5 platform mark; tenant logos remain independently configurable. */
export function KameSpaceBrandIcon({ className, iconClassName }: Props) {
  return (
    <img
      src="/brand/kame-space-mark.svg"
      alt=""
      aria-hidden="true"
      width={36}
      height={36}
      className={cn('h-9 w-9 shrink-0', className, iconClassName)}
    />
  );
}
