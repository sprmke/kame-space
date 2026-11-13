/**
 * Apply a Marketing Planner item's copy onto a video project.
 *
 * Mirrors the guest-review seed: the planner owns the words (hook, caption, call to action),
 * the editor owns the layout, scenes and music. Only the fields the planner actually carries
 * are replaced, so a template's own defaults survive everywhere else.
 */

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import type { PlannerHandoffPayload } from '@/features/dashboard/marketing/lib/planner/plannerHandoff';
import type { VideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  defaultLayersForKind,
  persistSceneLayers,
} from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import { textsForStoryboardBeats } from '@/features/dashboard/marketing/lib/video/videoSceneTexts';
import { resolveVideoStoryboardRecipe } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';
import { defaultVideoFields } from '@/features/dashboard/marketing/lib/videoCampaignTemplates';

/** Trim planner copy to what a video beat can hold without overflowing. */
export function trimVideoField(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function applyPlannerSeedToVideoProject(
  project: VideoProject,
  seed: PlannerHandoffPayload,
  binding: DesignBinding
): VideoProject {
  const defaults = defaultVideoFields(project.templateId, binding);
  const hook = seed.hook ? trimVideoField(seed.hook, 60) : '';
  const message = seed.message ? trimVideoField(seed.message, 90) : '';
  const cta = seed.cta ? trimVideoField(seed.cta, 32) : '';

  const sourceTexts = {
    ...defaults,
    ...(hook ? { headline: hook } : {}),
    ...(message ? { subheadline: message } : {}),
    ...(cta ? { ctaLine: cta } : {}),
  };

  const recipe = resolveVideoStoryboardRecipe(project.templateId);

  const scenes = project.scenes.map((scene, index) => {
    const clip = recipe.clips[index];
    const beats = clip?.textBeats ?? [];
    const texts = textsForStoryboardBeats(beats, sourceTexts);
    return persistSceneLayers(
      { ...scene, texts },
      defaultLayersForKind(scene.kind, scene.imageUrl, texts, project.templateId)
    );
  });

  return { ...project, scenes };
}
