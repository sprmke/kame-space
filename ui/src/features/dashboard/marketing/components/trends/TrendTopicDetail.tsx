import { useState } from 'react';

import { ArrowLeft, Copy } from 'lucide-react';
import { toast } from 'sonner';

import type {
  TrendAngle,
  TrendOutput,
  TrendSourceEvidence,
  TrendTopic,
} from '@/features/dashboard/marketing/lib/trends/trendTypes';
import { TREND_MOMENTUM_LABELS } from '@/features/dashboard/marketing/lib/trends/trendTypes';

import { Button } from '@/components/ui/button';

import { TrendAngleCard } from './TrendAngleCard';

type Props = {
  topic: TrendTopic;
  onUseAngle: (angle: TrendAngle) => void;
  onBack: () => void;
  canGenerate: (output: TrendOutput) => boolean;
};

const SOURCE_LABELS: Record<TrendSourceEvidence['source'], string> = {
  google_trends: 'Google Trends',
  wikimedia_ph: 'Wikipedia',
  wikimedia_tl: 'Wikipedia',
  apple_music: 'Apple Music',
  netflix: 'Netflix',
  editor: 'Added by staff',
};

/** Copy text, with a fallback for browsers that refuse the clipboard API. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'true');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

/**
 * One topic inside the Trends sheet: the summary, where it came from, the
 * three angles, and a free caption to copy.
 */
export function TrendTopicDetail({ topic, onUseAngle, onBack, canGenerate }: Props) {
  const [copying, setCopying] = useState(false);

  const copyCaption = async () => {
    setCopying(true);
    const copied = await copyToClipboard(topic.captionIdea);
    setCopying(false);
    if (copied) {
      toast('Caption copied');
      return;
    }
    toast('Could not copy', { description: topic.captionIdea });
  };

  const sources = [...new Set(topic.sources.map((entry) => SOURCE_LABELS[entry.source] ?? entry.source))];

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2 h-9 px-2">
        <ArrowLeft className="size-4" aria-hidden />
        All topics
      </Button>

      <div>
        <h3 className="text-card-title">{topic.title}</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{topic.summary}</p>
        <p className="text-caption mt-2">
          {TREND_MOMENTUM_LABELS[topic.momentum]}
          {topic.daysTrending > 1 ? ` · ${topic.daysTrending} days` : ''}
          {sources.length ? ` · ${sources.join(' · ')}` : ''}
        </p>
      </div>

      <ul className="space-y-2">
        {topic.angles.map((angle) => (
          <TrendAngleCard
            key={`${angle.title}-${angle.output}`}
            angle={angle}
            onUse={onUseAngle}
            disabled={!canGenerate(angle.output)}
          />
        ))}
      </ul>

      {topic.captionIdea ? (
        <div className="border-border/70 space-y-2 rounded-xl border p-3">
          <p className="text-sm leading-relaxed">{topic.captionIdea}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full"
            onClick={() => void copyCaption()}
            disabled={copying}
          >
            <Copy className="size-4" aria-hidden />
            Copy caption idea
          </Button>
        </div>
      ) : null}
    </div>
  );
}
