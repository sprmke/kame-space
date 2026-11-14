import { useEffect, useMemo, useState } from 'react';

import { posterSheetFixtures } from '@/features/dashboard/marketing/dev/posterSheetFixtures';
import { compilePosterDocument } from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import { buildRuleBasedPosterSpecs } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import {
  applyPhotoBlobs,
  photoAnalysisFromPreflight,
  photoSizesFromPreflight,
  preflightPosterPhotos,
  usablePhotoUrls,
} from '@/features/dashboard/marketing/lib/poster/posterPhotoPreflight';
import { renderPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterRender';
import { POST_SAMPLES, showcaseFacts } from '@/features/dashboard/marketing/lib/aiStudioSamples';
import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import {
  POSTER_ARCHETYPE_IDS,
  POSTER_GOALS,
  normalizePosterSpec,
  type PosterArchetypeId,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

const FORMATS: DesignTemplateFormat[] = [
  'instagram-portrait',
  'instagram-post',
  'instagram-story',
  'facebook-post',
];

type Cell = {
  key: string;
  label: string;
  status: 'pending' | 'ok' | 'error';
  src?: string;
  error?: string;
};

/**
 * Dev-only poster contact sheet: every goal layout x size x fixture through the
 * production compiler and renderer. `?format=` and `?fixture=` narrow the run.
 * Driven by `scripts/marketing/poster-contact-sheet/run.ts`.
 */
export function PosterSheetPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [cells, setCells] = useState<Cell[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fixtures = posterSheetFixtures(window.location.origin).filter(
      (f) => !params.get('fixture') || f.id === params.get('fixture')
    );
    const formats = FORMATS.filter((f) => !params.get('format') || f === params.get('format'));
    const update = (cell: Cell) =>
      setCells((prev) => [...prev.filter((c) => c.key !== cell.key), cell]);

    (async () => {
      // `?samples=1`: the AI Studio example cards, drawn with the stand-in showcase
      // listing at the size each example uses. `run.ts --samples` ships them as files.
      // `?presets=1`: every built-in Posts preset x size x three starter themes, through the
      // production thumbnail renderer (plan 9.1). `?format=` narrows by size.
      if (params.get('presets')) {
        const { DESIGN_CAMPAIGN_TEMPLATES } =
          await import('@/features/dashboard/marketing/lib/designCampaignTemplates');
        const { renderDesignPresetThumbnail } =
          await import('@/features/dashboard/marketing/lib/renderMarketingDesignThumbnail');
        const { DEFAULT_MARKETING_THUMB_BINDING } =
          await import('@/features/dashboard/marketing/lib/marketingDefaultBinding');
        const { listStarterThemes } =
          await import('@/features/dashboard/marketing/lib/theme/starterThemes');
        const seen = new Set<string>();
        const themes = listStarterThemes()
          .filter((theme) => !seen.has(theme.group) && seen.add(theme.group))
          .slice(0, 3);
        for (const template of DESIGN_CAMPAIGN_TEMPLATES) {
          if (params.get('format') && template.format !== params.get('format')) continue;
          for (const theme of themes) {
            if (cancelled) return;
            const key = `preset__${template.id}__${theme.id}`;
            try {
              const dataUrl = await renderDesignPresetThumbnail(
                template.id,
                DEFAULT_MARKETING_THUMB_BINDING,
                undefined,
                theme.tokens
              );
              if (!dataUrl) throw new Error('no document');
              update({ key, label: key, status: 'ok', src: dataUrl });
            } catch (error) {
              update({
                key,
                label: key,
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
        if (!cancelled) setDone(true);
        return;
      }
      // `?videos=1`: first-beat stills of every video recipe (Story), then each beat of a
      // reel built from the showcase listing (plan 8.3 and 9.3).
      if (params.get('videos')) {
        const [{ VIDEO_CAMPAIGN_TEMPLATES }, video, { DEFAULT_MARKETING_THUMB_BINDING }, reelMod] =
          await Promise.all([
            import('@/features/dashboard/marketing/lib/videoCampaignTemplates'),
            import('@/features/dashboard/marketing/lib/renderMarketingVideoThumbnail'),
            import('@/features/dashboard/marketing/lib/marketingDefaultBinding'),
            import('@/features/dashboard/marketing/lib/video/reelBuilder'),
          ]);
        const run = async (key: string, make: () => Promise<string | null>) => {
          try {
            const src = await make();
            if (!src) throw new Error('no frame');
            update({ key, label: key, status: 'ok', src });
          } catch (error) {
            update({
              key,
              label: key,
              status: 'error',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        };
        for (const template of VIDEO_CAMPAIGN_TEMPLATES) {
          if (cancelled) return;
          await run(`video__${template.id}`, () =>
            video.renderVideoPresetThumbnail(
              template.id,
              'instagram-story',
              DEFAULT_MARKETING_THUMB_BINDING
            )
          );
        }
        const reel = reelMod.buildReel(showcaseFacts(window.location.origin), {
          format: 'instagram-story',
        });
        for (const [index] of (reel?.project.scenes ?? []).entries()) {
          if (cancelled) return;
          await run(`reel__beat-${index + 1}`, () =>
            video.renderVideoSceneThumbnail(reel!.project, index)
          );
        }
        // Motion check: the text entrance over its first 0.5 s, then a push-in aimed at
        // the right edge of the first photo (focal 0.9, 0.5) at the start and near the end.
        for (const frame of [0, 4, 8, 12, 16]) {
          if (cancelled) return;
          await run(`motion__text-f${String(frame).padStart(2, '0')}`, () =>
            video.renderVideoSceneThumbnail(reel!.project, 0, undefined, undefined, frame)
          );
        }
        if (reel) {
          const firstUrl = reel.project.scenes[0]?.imageUrl;
          const aimed = reelMod.applyFocalPoints(reel.project, firstUrl ? { [firstUrl]: { x: 0.9, y: 0.5 } } : {});
                    for (const frame of [0, 40, 75]) {
            if (cancelled) return;
            await run(`motion__focal-f${String(frame).padStart(3, '0')}`, () =>
              video.renderVideoSceneThumbnail(aimed, 0, undefined, undefined, frame)
            );
          }
        }
        if (!cancelled) setDone(true);
        return;
      }
      if (params.get('samples')) {
        const facts0 = showcaseFacts(window.location.origin);
        const pre = await preflightPosterPhotos(facts0.photos);
        const facts = { ...facts0, photos: usablePhotoUrls(facts0.photos, pre) };
        for (const sample of POST_SAMPLES) {
          if (cancelled) return;
          const key = `sample__${sample.id}`;
          try {
            const base = buildRuleBasedPosterSpecs(facts, sample.goal, { count: 4 });
            const found = base.find((item) => item.archetype === sample.archetype) ?? base[0]!;
            // Curated examples read in English; the library rotates Taglish sets in for hosts.
            const taglish =
              /\b(dito|mo|na|ka|ng|sa|ang|pahinga|puro|lang|tara|para|bakasyon|walang|kumpleto|pasok|kayo|natin)\b/i;
            const english =
              base.find(
                (item) =>
                  !taglish.test(
                    [
                      item.copy.eyebrow,
                      item.copy.accent,
                      item.copy.subhead,
                      item.copy.tagline,
                    ].join(' ')
                  )
              ) ?? found;
            const spec = normalizePosterSpec(
              {
                ...found,
                copy: english.copy,
                archetype: sample.archetype,
                fontPairing: POSTER_ARCHETYPE_DEFAULT_FONTS[sample.archetype],
              },
              facts
            );
            const document = compilePosterDocument(spec, facts, sample.format, {
              photoSizes: photoSizesFromPreflight(pre),
              photoAnalysis: photoAnalysisFromPreflight(pre),
            });
            const { dataUrl } = await renderPosterDocument(applyPhotoBlobs(document, pre), {
              pixelRatio: 0.75,
            });
            update({ key, label: key, status: 'ok', src: dataUrl });
          } catch (error) {
            update({
              key,
              label: key,
              status: 'error',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        if (!cancelled) setDone(true);
        return;
      }
      for (const fixture of fixtures) {
        const pre = await preflightPosterPhotos(fixture.facts.photos);
        const facts = { ...fixture.facts, photos: usablePhotoUrls(fixture.facts.photos, pre) };
        for (const goal of POSTER_GOALS) {
          const only = params.get('layouts')?.split(',').filter(Boolean) ?? [];
          // `?layouts=a,b` pins those layouts (vibe goal only) instead of the goal defaults.
          if (only.length > 0 && goal !== 'vibe') continue;
          const base = buildRuleBasedPosterSpecs(facts, goal, { count: 4 });
          const specs =
            only.length > 0
              ? only.flatMap((id) =>
                  POSTER_ARCHETYPE_IDS.includes(id as PosterArchetypeId)
                    ? [
                        normalizePosterSpec(
                          {
                            ...base[0],
                            archetype: id,
                            fontPairing: POSTER_ARCHETYPE_DEFAULT_FONTS[id as PosterArchetypeId],
                          },
                          facts
                        ),
                      ]
                    : []
                )
              : base;
          for (const [index, spec] of specs.entries()) {
            for (const format of formats) {
              if (cancelled) return;
              const key = `${fixture.id}__${goal}-${index + 1}-${spec.archetype}__${format}`;
              try {
                const document = compilePosterDocument(spec, facts, format, {
                  photoSizes: photoSizesFromPreflight(pre),
                  photoAnalysis: photoAnalysisFromPreflight(pre),
                });
                const { dataUrl } = await renderPosterDocument(applyPhotoBlobs(document, pre), {
                  pixelRatio: 0.5,
                });
                update({ key, label: key, status: 'ok', src: dataUrl });
              } catch (error) {
                update({
                  key,
                  label: key,
                  status: 'error',
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
          }
        }
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <main className="p-4" data-done={done ? 'true' : 'false'} data-testid="poster-sheet">
      <h1 className="mb-4 text-lg font-semibold">Poster contact sheet (dev)</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...cells]
          .sort((a, b) => a.key.localeCompare(b.key))
          .map((cell) => (
            <figure key={cell.key} data-cell={cell.key} data-status={cell.status}>
              {cell.src ? (
                <img src={cell.src} alt={cell.label} className="w-full" />
              ) : (
                <div className="p-2 text-xs text-red-600">{cell.error}</div>
              )}
              <figcaption className="break-all text-[10px]">{cell.label}</figcaption>
            </figure>
          ))}
      </div>
    </main>
  );
}
