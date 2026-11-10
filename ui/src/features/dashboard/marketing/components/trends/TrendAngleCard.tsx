import { Clapperboard, FileText, ImageIcon } from 'lucide-react';

import type { TrendAngle, TrendOutput } from '@/features/dashboard/marketing/lib/trends/trendTypes';

import { Button } from '@/components/ui/button';

const OUTPUT_ICON: Record<TrendOutput, typeof FileText> = {
  post: FileText,
  image: ImageIcon,
  video: Clapperboard,
};

const OUTPUT_LABEL: Record<TrendOutput, string> = {
  post: 'Make a post',
  image: 'Make a photo',
  video: 'Make a clip',
};

type Props = {
  angle: TrendAngle;
  onUse: (angle: TrendAngle) => void;
  disabled?: boolean;
};

/** One angle: what the host could make, and the button that starts it. */
export function TrendAngleCard({ angle, onUse, disabled }: Props) {
  const Icon = OUTPUT_ICON[angle.output] ?? FileText;
  return (
    <li className="border-border bg-card rounded-xl border p-3">
      <div className="flex items-start gap-2">
        <span className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{angle.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{angle.hook}</p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2.5 h-9 w-full"
        disabled={disabled}
        onClick={() => onUse(angle)}
      >
        {OUTPUT_LABEL[angle.output]}
      </Button>
    </li>
  );
}
