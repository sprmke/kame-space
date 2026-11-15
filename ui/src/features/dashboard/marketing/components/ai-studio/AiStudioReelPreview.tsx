import { useEffect, useMemo, useState } from 'react';

import { Player } from '@remotion/player';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';

import { CampaignVideoComposition } from '@/features/dashboard/marketing/components/video-editor/VideoCompositions';
import type { AiPosterEngine } from '@/features/dashboard/marketing/hooks/useAiPosterEngine';
import {
  REEL_RECIPE_IDS,
  type ReelBuild,
  type ReelRecipeId,
} from '@/features/dashboard/marketing/lib/video/reelBuilder';
import type { ReelDirection } from '@/features/dashboard/marketing/lib/video/reelDirection';
import { handleAiMutationError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { videoProjectDurationInFrames } from '@/features/dashboard/marketing/lib/video/videoProjectUtils';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { SegmentedControl } from '@/components/ui/sliding-tabs';

const RECIPE_LABEL: Record<ReelRecipeId, string> = { tour: 'Tour', highlights: 'Highlights' };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engine: AiPosterEngine;
  photoUrls: string[];
  /** Saves the shown recipe as a video and opens it in Videos. */
  onEdit: (recipe: ReelRecipeId, direction: ReelDirection | null) => Promise<void>;
};

/**
 * Plays the free, deterministic reel before it is saved. Switching the recipe rebuilds it
 * at no cost; Edit in Videos saves the one on screen.
 */
export function AiStudioReelPreview({ open, onOpenChange, engine, photoUrls, onEdit }: Props) {
  const [recipe, setRecipe] = useState<ReelRecipeId>('tour');
  const [reel, setReel] = useState<ReelBuild | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<ReelDirection | null>(null);
  const [directing, setDirecting] = useState(false);

  const direct = async () => {
    setDirecting(true);
    try {
      const next = await engine.directReel({ photoUrls });
      if (next) {
        setDirection(next);
        setRecipe(next.recipe);
      } else {
        toast.error('The AI could not direct this one. The free reel is still here.');
      }
    } catch (err) {
      handleAiMutationError(err as Error);
    } finally {
      setDirecting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReel(null);
    setError(null);
    engine
      .buildReelFor({
        photoUrls: direction?.photoUrls ?? photoUrls,
        recipe,
        copy: direction?.copy,
      })
      .then((built) => {
        if (!cancelled) setReel(built);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not build the reel.');
      });
    return () => {
      cancelled = true;
    };
    // `engine` changes identity with its inputs; the reel only depends on the choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipe, direction, photoUrls.join('|')]);

  const frames = useMemo(() => (reel ? videoProjectDurationInFrames(reel.project) : 0), [reel]);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Preview reel</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <SegmentedControl
            value={recipe}
            onChange={(value) => setRecipe(value as ReelRecipeId)}
            options={REEL_RECIPE_IDS.map((id) => ({ value: id, label: RECIPE_LABEL[id] }))}
            aria-label="Reel style"
          />
          <div className="bg-muted mx-auto aspect-[9/16] max-h-[60vh] w-full max-w-[260px] overflow-hidden rounded-xl">
            {reel ? (
              <Player
                key={`${recipe}-${frames}`}
                component={CampaignVideoComposition}
                durationInFrames={Math.max(1, frames)}
                compositionWidth={1080}
                compositionHeight={1920}
                fps={reel.project.fps}
                inputProps={{ project: reel.project, previewMuted: true }}
                style={{ width: '100%', height: '100%' }}
                controls
                loop
                autoPlay
                initiallyMuted
                acknowledgeRemotionLicense
              />
            ) : error ? (
              <p className="text-muted-foreground p-4 text-sm">{error}</p>
            ) : (
              <div className="flex size-full items-center justify-center">
                <Loader2 className="size-5 animate-spin" aria-label="Building reel" />
              </div>
            )}
          </div>
          <Button variant="outline" disabled={directing || saving} onClick={() => void direct()}>
            {directing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {direction ? 'Direct again with AI' : 'Direct with AI'}
          </Button>
          <Button
            disabled={!reel || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onEdit(recipe, direction);
              } finally {
                setSaving(false);
              }
            }}
          >
            Edit in Videos
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
