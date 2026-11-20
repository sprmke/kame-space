import type { ReactNode } from 'react';

import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

type ListRowProps = {
  title: string;
  meta?: string;
  lead?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
};

/** Lead · title · meta · trailing. Whole row is the hit target when `onClick` is set. */
export function ListRow({
  title,
  meta,
  lead,
  trailing,
  chevron = false,
  onClick,
  className,
}: ListRowProps) {
  const body = (
    <>
      {lead ? <span className="shrink-0">{lead}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="text-native-row text-foreground block truncate">{title}</span>
        {meta ? <span className="text-native-meta mt-0.5 line-clamp-2 block">{meta}</span> : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
      {chevron ? (
        <ChevronRight
          className="text-muted-foreground size-5 shrink-0"
          strokeWidth={1.75}
          aria-hidden
        />
      ) : null}
    </>
  );

  const rowClass = cn(
    'border-hairline flex min-h-14 w-full items-center gap-3 border-b px-4 py-2.5 text-left',
    onClick && 'native-v3-press',
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {body}
      </button>
    );
  }

  return <div className={rowClass}>{body}</div>;
}
