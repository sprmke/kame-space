import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type ActionRowCardProps = {
  title: string;
  meta?: string;
  lead?: ReactNode;
  actionLabel: string;
  onAction: () => void;
  onClick?: () => void;
  className?: string;
};

/** Row card with an inline named next action ("Check in"). */
export function ActionRowCard({
  title,
  meta,
  lead,
  actionLabel,
  onAction,
  onClick,
  className,
}: ActionRowCardProps) {
  return (
    <div
      className={cn(
        'border-hairline bg-card shadow-native-card rounded-native-row border p-3',
        className
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-3 text-left',
          !onClick && 'pointer-events-none'
        )}
      >
        {lead ? <span className="shrink-0">{lead}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="text-native-row text-foreground block truncate">{title}</span>
          {meta ? <span className="text-native-meta mt-0.5 line-clamp-2 block">{meta}</span> : null}
        </span>
      </button>
      <div className="mt-2.5 flex justify-end">
        <button
          type="button"
          onClick={onAction}
          className="native-v3-press bg-primary-strong text-primary-foreground text-native-button rounded-native-control inline-flex h-10 min-w-[44px] items-center justify-center px-3.5"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
