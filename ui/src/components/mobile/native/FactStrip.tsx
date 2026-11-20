import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export type FactStripItem = {
  icon: LucideIcon;
  label: string;
};

type FactStripProps = {
  facts: FactStripItem[];
  className?: string;
};

/** 3 to 4 facts with icons under a detail app bar. */
export function FactStrip({ facts, className }: FactStripProps) {
  return (
    <ul
      className={cn(
        'text-native-meta text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1',
        className
      )}
    >
      {facts.map((fact) => (
        <li key={fact.label} className="inline-flex items-center gap-1.5">
          <fact.icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          <span>{fact.label}</span>
        </li>
      ))}
    </ul>
  );
}
