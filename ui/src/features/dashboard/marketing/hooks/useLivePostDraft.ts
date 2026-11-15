import { useEffect, useRef, useState } from 'react';

import type { AiPosterEngine } from '@/features/dashboard/marketing/hooks/useAiPosterEngine';
import { POSTER_GOAL_ARCHETYPES } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import {
  sanitizePosterOffer,
  type PosterOffer,
} from '@/features/dashboard/marketing/lib/poster/posterOffer';
import type { PosterGoal } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

const DEBOUNCE_MS = 700;

type Input = {
  enabled: boolean;
  goal: PosterGoal;
  format: DesignTemplateFormat;
  picks: string[];
  offer: Partial<PosterOffer> | null;
};

/**
 * A real post from the current form, drawn by the rule-based engine (no AI call, no
 * credits), so the preview shows something true before Generate. Debounced; a newer
 * request makes an older render's result drop. Failures leave the last good image.
 */
export function useLivePostDraft(engine: AiPosterEngine, input: Input) {
  const { enabled, goal, format, picks, offer } = input;
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const run = useRef(0);
  const key = JSON.stringify({ goal, format, picks, offer });
  const renderSample = engine.renderSample;
  const baseFacts = engine.baseFacts;
  const ready = engine.ready;

  useEffect(() => {
    if (!enabled || !ready || baseFacts.photos.length === 0) return;
    const token = ++run.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      renderSample({
        goal,
        archetype: POSTER_GOAL_ARCHETYPES[goal][0]!,
        format,
        picks,
        facts: {
          ...baseFacts,
          offer: goal === 'promo' ? sanitizePosterOffer(offer) : null,
        },
      })
        .then((dataUrl) => {
          if (run.current === token) setUrl(dataUrl);
        })
        .catch(() => undefined)
        .finally(() => {
          if (run.current === token) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // `key` captures the form values; the rest are stable engine references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ready, key, baseFacts, renderSample]);

  return { url: enabled ? url : null, loading };
}
