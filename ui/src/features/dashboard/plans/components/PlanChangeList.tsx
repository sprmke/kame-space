import { Check, Minus } from 'lucide-react';

import type { PlanFeatureChange } from '@/features/dashboard/plans/lib/planPresentation';

/** A titled list of features a plan change adds ("Unlocks") or takes away ("Turns off on ..."). */
export function PlanChangeList({
  title,
  items,
  tone,
}: {
  title: string;
  items: PlanFeatureChange[];
  tone: 'gain' | 'loss';
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2.5 text-sm leading-relaxed">
            {tone === 'gain' ? (
              <Check
                className="text-primary mt-0.5 size-4 shrink-0"
                strokeWidth={2.5}
                aria-hidden
              />
            ) : (
              <Minus className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span className={tone === 'loss' ? 'text-muted-foreground' : undefined}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
