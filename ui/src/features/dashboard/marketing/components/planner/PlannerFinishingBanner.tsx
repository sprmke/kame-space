import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  clearPlannerFinishing,
  getPlannerFinishing,
  type PlannerFinishingContext,
} from '@/features/dashboard/marketing/lib/planner/plannerHandoff';

type Props = {
  onBackToPlan: () => void;
};

/** Sticky cue while a Plan item is open in Studio. */
export function PlannerFinishingBanner({ onBackToPlan }: Props) {
  const [ctx, setCtx] = useState<PlannerFinishingContext | null>(() => getPlannerFinishing());

  useEffect(() => {
    setCtx(getPlannerFinishing());
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ks.marketing.planner.finishing') setCtx(getPlannerFinishing());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Same-tab updates: poll lightly when banner might appear after handoff.
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = getPlannerFinishing();
      setCtx((prev) => {
        if (prev?.itemId === next?.itemId && prev?.title === next?.title) return prev;
        return next;
      });
    }, 800);
    return () => window.clearInterval(id);
  }, []);

  if (!ctx) return null;

  return (
    <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-3 py-2 sm:px-4">
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="text-muted-foreground">Finishing: </span>
        <span className="font-medium">{ctx.title}</span>
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => {
          onBackToPlan();
        }}
      >
        Back to Plan
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 shrink-0"
        aria-label="Dismiss"
        onClick={() => {
          clearPlannerFinishing();
          setCtx(null);
        }}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
