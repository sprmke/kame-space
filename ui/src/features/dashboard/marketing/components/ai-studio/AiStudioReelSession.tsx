import { useEffect, useMemo, useState } from 'react';

import { Player } from '@remotion/player';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';

import { CampaignVideoComposition } from '@/features/dashboard/marketing/components/video-editor/VideoCompositions';
import type { AiPosterEngine } from '@/features/dashboard/marketing/hooks/useAiPosterEngine';
import type { AiPostVersionRecord } from '@/features/dashboard/marketing/lib/aiStudioSessions';
import {
  REEL_RECIPE_IDS,
  type ReelBuild,
  type ReelRecipeId,
} from '@/features/dashboard/marketing/lib/video/reelBuilder';
import type { ReelDirection } from '@/features/dashboard/marketing/lib/video/reelDirection';
import { videoProjectDurationInFrames } from '@/features/dashboard/marketing/lib/video/videoProjectUtils';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** A saved reel version holds the director's direction in its spec. */
export function directionOfVersion(version: AiPostVersionRecord): ReelDirection {
  const spec = version.spec as { recipe?: unknown; copy?: Record<string, unknown> | null };
  const recipe = REEL_RECIPE_IDS.find((id) => id === spec.recipe) ?? REEL_RECIPE_IDS[0]!;
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    recipe: recipe as ReelRecipeId,
    photoUrls: version.photoUrls,
    copy: {
      headline: text(spec.copy?.headline),
      subheadline: text(spec.copy?.subheadline),
      ctaLine: text(spec.copy?.ctaLine),
    },
  };
}

type Props = {
  versions: AiPostVersionRecord[];
  engine: AiPosterEngine;
  canChange: boolean;
  busy: boolean;
  /** Billed: directs a new version from the host's words. */
  onDirect: (prompt: string, parent: AiPostVersionRecord) => Promise<void>;
  onEdit: (version: AiPostVersionRecord) => Promise<void>;
  onDelete: (version: AiPostVersionRecord) => void;
};

/** One reel conversation: the picked version plays, the rest sit in a strip. */
export function AiStudioReelSession({
  versions,
  engine,
  canChange,
  busy,
  onDirect,
  onEdit,
  onDelete,
}: Props) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [reel, setReel] = useState<ReelBuild | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A version that just landed goes on stage.
  const lastId = versions[versions.length - 1]?.id ?? null;
  useEffect(() => {
    if (lastId) setPickedId(lastId);
  }, [lastId]);

  const selected = versions.find((version) => version.id === pickedId) ?? versions.at(-1) ?? null;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setReel(null);
    setError(null);
    const direction = directionOfVersion(selected);
    engine
      .buildReelFor({
        photoUrls: direction.photoUrls,
        recipe: direction.recipe,
        copy: direction.copy,
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
    // `engine` changes identity with its inputs; the reel only depends on the version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const frames = useMemo(() => (reel ? videoProjectDurationInFrames(reel.project) : 0), [reel]);
  if (!selected) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4 lg:flex-row lg:gap-6 lg:p-6">
      <div className="mx-auto flex w-full max-w-[280px] flex-col gap-3 lg:mx-0 lg:shrink-0">
        <div className="bg-muted aspect-[9/16] max-h-[65vh] w-full overflow-hidden rounded-xl">
          {reel ? (
            <Player
              key={`${selected.id}-${frames}`}
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
        <Button disabled={!reel || busy || !canChange} onClick={() => void onEdit(selected)}>
          Edit in Videos
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ul className="flex flex-wrap gap-2" aria-label="Reel versions">
          {versions.map((version, index) => (
            <li key={version.id} className="flex">
              <button
                type="button"
                aria-label={`Open version ${index + 1}`}
                aria-current={version.id === selected.id}
                onClick={() => setPickedId(version.id)}
                className={cn(
                  'border-border focus-visible:ring-ring min-h-11 rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-2',
                  version.id === selected.id ? 'bg-muted font-medium' : 'hover:bg-muted/60'
                )}
              >
                {index + 1}
              </button>
              {canChange && versions.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Delete version ${index + 1}`}
                  disabled={busy}
                  onClick={() => onDelete(version)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {canChange ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              const prompt = text.trim();
              setText('');
              void onDirect(prompt, selected);
            }}
          >
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, 500))}
              placeholder="Change the reel, or leave empty for another take"
              rows={2}
              disabled={busy}
              aria-label="Change the reel"
            />
            <Button type="submit" variant="outline" disabled={busy} className="self-start">
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              Direct again
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
