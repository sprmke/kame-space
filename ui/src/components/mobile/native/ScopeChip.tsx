import { ChevronDown } from 'lucide-react';

import { NativeAvatar } from '@/components/mobile/native/NativeAvatar';
import { cn } from '@/lib/utils';

type ScopeChipProps = {
  name: string;
  parentLine?: string;
  photoUrl?: string | null;
  /** Parking shows a P badge when no photo. */
  parking?: boolean;
  onClick?: () => void;
  className?: string;
};

/** Workspace identity + switcher trigger on the brand app bar. */
export function ScopeChip({
  name,
  parentLine,
  photoUrl,
  parking = false,
  onClick,
  className,
}: ScopeChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'native-v3-press bg-appbar-control inline-flex max-w-[min(100%,16rem)] items-center gap-2 rounded-full py-1 pl-1 pr-2.5',
        'focus-visible:ring-appbar-foreground/40 min-h-11 focus-visible:outline-none focus-visible:ring-2',
        className
      )}
      aria-label={
        parentLine ? `${name}, ${parentLine}. Switch workspace` : `${name}. Switch workspace`
      }
    >
      <NativeAvatar
        src={photoUrl}
        name={name}
        badge={parking && !photoUrl ? 'P' : undefined}
        size={32}
      />
      <span className="min-w-0 flex-1 text-left">
        <span className="text-appbar-foreground block truncate text-[13px] font-semibold leading-4">
          {name}
        </span>
        {parentLine ? (
          <span className="text-appbar-muted block truncate text-[11px] leading-4">
            {parentLine}
          </span>
        ) : null}
      </span>
      <ChevronDown className="text-appbar-muted size-4 shrink-0" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
