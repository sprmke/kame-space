import { cn } from '@/lib/utils';

export type MetricStripItem = {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  onClick?: () => void;
};

type MetricStripProps = {
  metrics: MetricStripItem[];
  className?: string;
};

/** Up to 3 metrics visible; horizontally scrollable for more. */
export function MetricStrip({ metrics, className }: MetricStripProps) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      {metrics.map((metric) => {
        const Comp = metric.onClick ? 'button' : 'div';
        return (
          <Comp
            key={metric.label}
            type={metric.onClick ? 'button' : undefined}
            onClick={metric.onClick}
            className={cn(
              'border-hairline bg-card shadow-native-card rounded-native-row min-w-[7.5rem] flex-1 border p-3 text-left',
              metric.onClick && 'native-v3-press'
            )}
          >
            <p className="text-native-label">{metric.label}</p>
            <p className="text-native-metric text-foreground mt-1">{metric.value}</p>
            {metric.delta ? (
              <p
                className={cn(
                  'text-native-meta mt-0.5',
                  metric.deltaPositive === true && 'text-pill-positive-foreground',
                  metric.deltaPositive === false && 'text-pill-critical-foreground'
                )}
              >
                {metric.delta}
              </p>
            ) : null}
          </Comp>
        );
      })}
    </div>
  );
}
