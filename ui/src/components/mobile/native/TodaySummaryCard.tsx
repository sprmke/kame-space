import { KameMascot } from '@/components/mascot/KameMascot';
import type { KameMascotPose } from '@/components/mascot/kameMascotPoses';
import { cn } from '@/lib/utils';

export type TodaySummaryStat = {
  label: string;
  value: string | number;
};

type TodaySummaryCardProps = {
  stats: TodaySummaryStat[];
  /** Optional 56px daily-guidance mascot. At most one on the screen. */
  mascotPose?: KameMascotPose;
  className?: string;
};

/**
 * Deterministic day counts (arrivals, checkouts, unread, payments due).
 * No AI / Kame label on the counts themselves (R7).
 */
export function TodaySummaryCard({ stats, mascotPose, className }: TodaySummaryCardProps) {
  return (
    <div
      className={cn(
        'border-hairline bg-card shadow-native-card rounded-native-card flex items-center gap-3 border p-4',
        className
      )}
    >
      {mascotPose ? <KameMascot pose={mascotPose} role="daily" className="shrink-0" /> : null}
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <p className="text-native-label truncate">{stat.label}</p>
            <p className="text-native-metric text-foreground mt-0.5 tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
