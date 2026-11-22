import { CalendarCheck2, Paintbrush, Share2 } from 'lucide-react';

import { HowItWorksButton } from '@/components/help/HowItWorksButton';
import type { HowItWorksStep } from '@/lib/help/types';

const STEPS: HowItWorksStep[] = [
  {
    icon: CalendarCheck2,
    title: 'Plan suggests',
    body: 'From your open nights, rates and reviews. Nothing invented.',
  },
  {
    icon: Paintbrush,
    title: 'You make it',
    body: 'Open the post, video or calendar in Marketing Studio.',
  },
  {
    icon: Share2,
    title: 'You share or mark done',
    body: 'Publish in Meta, share by hand, or tap I posted it.',
  },
];

type Props = {
  compact?: boolean;
};

/** Purpose + loop for the planner. Hosts asked for education, not chrome. */
export function PlannerLoopIntro({ compact = false }: Props) {
  return (
    <div
      className={
        compact
          ? 'space-y-2'
          : 'border-border/70 space-y-3 rounded-xl border bg-muted/20 p-3.5 sm:p-4'
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug">What to post next, and why</p>
          <p className="text-caption text-muted-foreground leading-relaxed">
            Built from your calendar. Suggest, make in Studio, then share or mark done.
          </p>
        </div>
        <HowItWorksButton
          feature="plan"
          label="How Plan works"
          title="How Plan works"
          steps={STEPS}
          tip="We hold a post if the dates book before you share it."
          className="shrink-0"
        />
      </div>
      {!compact ? (
        <ol className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="bg-background/80 rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <Icon className="text-primary size-3.5 shrink-0" aria-hidden />
                  <p className="text-caption text-muted-foreground">{index + 1}</p>
                </div>
                <p className="text-sm font-medium leading-snug">{step.title}</p>
                <p className="text-caption text-muted-foreground mt-0.5 leading-snug">{step.body}</p>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
