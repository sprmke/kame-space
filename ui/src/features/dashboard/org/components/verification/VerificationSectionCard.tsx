import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  /** One short line under the title. Only when it changes what the host does. */
  description?: string;
  /** Right side of the title row — a count, a badge, a compact action. */
  meta?: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  /** Override the default `px-4 pb-4` body (use `px-0 pb-0` for divided lists). */
  bodyClassName?: string;
};

/** One visual group inside a verification panel: header row, short copy, body. */
export function VerificationSectionCard({
  title,
  description,
  meta,
  icon: Icon,
  children,
  className,
  bodyClassName,
}: Props) {
  return (
    <section className={cn('border-border bg-card overflow-hidden rounded-xl border', className)}>
      <header className="flex min-w-0 items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 items-start gap-2">
          {Icon ? (
            <span className="bg-muted text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md">
              <Icon className="size-3.5" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className="text-foreground text-sm font-semibold leading-tight">{title}</h3>
              {meta}
            </div>
            {description ? (
              <p className="text-muted-foreground text-xs leading-snug">{description}</p>
            ) : null}
          </div>
        </div>
      </header>
      <div className={cn('px-4 pb-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Count that sits beside a section title, e.g. `1/2`. */
export function VerificationSectionCount({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground shrink-0 text-xs tabular-nums leading-none">
      {children}
    </span>
  );
}
