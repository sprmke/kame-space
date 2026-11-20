import {
  formatSummarySegment,
  type SummaryStripSegment,
} from '@/components/mobile/native/summaryStripFormat';
import { cn } from '@/lib/utils';

type SummaryStripProps = {
  segments: SummaryStripSegment[];
  onSelect?: (filterKey: string | undefined, index: number) => void;
  className?: string;
};

/** One line of tappable counts (wraps to 2 lines max). */
export function SummaryStrip({ segments, onSelect, className }: SummaryStripProps) {
  return (
    <div
      className={cn(
        'bg-tint text-tint-foreground rounded-native-row flex flex-wrap items-center gap-x-0 gap-y-1 px-3 py-2.5',
        className
      )}
      role="group"
      aria-label="Summary"
    >
      {segments.map((segment, index) => {
        const label = formatSummarySegment(segment);
        const interactive = Boolean(onSelect);
        const Comp = interactive ? 'button' : 'span';
        return (
          <span key={`${segment.filterKey ?? segment.label}-${index}`} className="contents">
            {index > 0 ? (
              <span className="text-tint-foreground/50 px-1.5" aria-hidden>
                ·
              </span>
            ) : null}
            <Comp
              type={interactive ? 'button' : undefined}
              onClick={interactive ? () => onSelect?.(segment.filterKey, index) : undefined}
              className={cn(
                'text-native-meta text-tint-foreground font-medium',
                interactive && 'native-v3-press underline-offset-2 hover:underline'
              )}
            >
              {label}
            </Comp>
          </span>
        );
      })}
    </div>
  );
}
