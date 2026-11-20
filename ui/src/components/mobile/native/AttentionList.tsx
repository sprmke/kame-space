import { Link } from 'react-router-dom';

import { ListRow } from '@/components/mobile/native/ListRow';
import type { PillTone } from '@/components/mobile/native/pillTone';
import { StatusPill } from '@/components/mobile/native/StatusPill';
import { cn } from '@/lib/utils';

export type AttentionListItem = {
  id: string;
  label: string;
  href: string;
  count?: number;
  severity?: 'critical' | 'warning' | 'info';
};

type AttentionListProps = {
  title?: string;
  items: AttentionListItem[];
  max?: number;
  viewAllHref?: string;
  className?: string;
};

function toneFor(severity: AttentionListItem['severity']): PillTone {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'attention';
  return 'neutral';
}

/** Needs-attention rows for Today (F1). Cap at `max`, optional View all. */
export function AttentionList({
  title = 'Needs attention',
  items,
  max = 5,
  viewAllHref,
  className,
}: AttentionListProps) {
  const visible = items.slice(0, max);
  if (visible.length === 0) return null;

  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-native-section text-foreground">{title}</h2>
        {viewAllHref ? (
          <Link
            to={viewAllHref}
            className="text-native-meta text-primary native-v3-press inline-flex min-h-11 items-center px-1 font-medium"
          >
            View all
          </Link>
        ) : null}
      </div>
      <div className="border-hairline bg-card rounded-native-row overflow-hidden border">
        {visible.map((item) => (
          <Link key={item.id} to={item.href} className="block">
            <ListRow
              title={item.label}
              trailing={
                item.count != null ? (
                  <StatusPill tone={toneFor(item.severity)}>{item.count}</StatusPill>
                ) : item.severity && item.severity !== 'info' ? (
                  <StatusPill tone={toneFor(item.severity)}>
                    {item.severity === 'critical' ? 'Urgent' : 'Soon'}
                  </StatusPill>
                ) : undefined
              }
              chevron
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
