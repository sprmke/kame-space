import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  /** One short line under the title when the empty state needs context. */
  description?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function HelpEmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: Props) {
  return (
    <div
      className={
        compact
          ? 'flex flex-col items-center justify-center px-4 py-8 text-center sm:py-12'
          : 'flex flex-col items-center justify-center px-4 py-8 text-center sm:px-6 sm:py-20'
      }
    >
      <div className="bg-primary/10 text-primary mb-4 flex size-14 items-center justify-center rounded-2xl">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="text-foreground max-w-sm text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
        {title}
      </p>
      {description ? (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-snug [overflow-wrap:anywhere]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
