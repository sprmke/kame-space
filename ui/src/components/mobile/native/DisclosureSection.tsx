import { useState, type ReactNode } from 'react';

import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type DisclosureSectionProps = {
  icon?: LucideIcon;
  title: string;
  preview?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/** Expands in place with a value preview when collapsed. */
export function DisclosureSection({
  icon: Icon,
  title,
  preview,
  defaultOpen = false,
  children,
  className,
}: DisclosureSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('border-hairline border-b', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="native-v3-press flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        {Icon ? (
          <Icon className="text-muted-foreground size-5 shrink-0" strokeWidth={1.75} />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="text-native-row text-foreground block truncate">{title}</span>
          {!open && preview ? (
            <span className="text-native-meta mt-0.5 block truncate">{preview}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'text-muted-foreground duration-native-title ease-native size-5 shrink-0 transition-transform',
            open && 'rotate-180'
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      {open ? <div className="px-4 pb-3">{children}</div> : null}
    </div>
  );
}
