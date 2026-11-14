import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ChevronLeft,
  Clapperboard,
  Copy,
  Download,
  Film,
  History,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  PenLine,
  SlidersHorizontal,
  Send,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { AI_OUTPUT_ICON } from '@/features/dashboard/marketing/components/ai-studio/AiSessionCard';
import { AiStudioCaptionCard } from '@/features/dashboard/marketing/components/ai-studio/AiStudioCaptionCard';
import {
  AiStudioCreate,
  OUTPUT_FEATURE,
  POST_FORMATS,
  SizeSelect,
  type AiCreateRequest,
} from '@/features/dashboard/marketing/components/ai-studio/AiStudioCreate';
import { useAiOutputAccess } from '@/features/dashboard/marketing/components/ai-studio/AiStudioHome';
import { AiStudioPostGrid } from '@/features/dashboard/marketing/components/ai-studio/AiStudioPostGrid';
import type { ReelDirection } from '@/features/dashboard/marketing/lib/video/reelDirection';
import { isAiQuotaError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { AiStudioReelSession, directionOfVersion } from '@/features/dashboard/marketing/components/ai-studio/AiStudioReelSession';
import { AiStudioReelPreview } from '@/features/dashboard/marketing/components/ai-studio/AiStudioReelPreview';
import { AiStudioQuickEdit } from '@/features/dashboard/marketing/components/ai-studio/AiStudioQuickEdit';
import { AiStudioRefineBox } from '@/features/dashboard/marketing/components/ai-studio/AiStudioRefineBox';
import { AiStudioStage } from '@/features/dashboard/marketing/components/ai-studio/AiStudioStage';
import {
  AiStudioThread,
  VersionThumb,
  type AiPendingTurn,
} from '@/features/dashboard/marketing/components/ai-studio/AiStudioThread';
import { MarketingInlineName } from '@/features/dashboard/marketing/components/shared/MarketingInlineName';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { useAiPosterEngine } from '@/features/dashboard/marketing/hooks/useAiPosterEngine';
import { useGenerateMarketingMedia } from '@/features/dashboard/marketing/hooks/useGenerateMarketingMedia';
import {
  useAiPremiumFlags,
  useAiSession,
  useDeleteAiSessions,
  useDeleteAiVersion,
  useRenameAiSession,
  useSavePostVersions,
} from '@/features/dashboard/marketing/hooks/useMarketingAiSessions';
import {
  GenerationRequestError,
  failedJobFromError,
  handleGenerationError,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationApi';
import {
  useMarketingGenerationReferences,
  useUploadMarketingGenerationReference,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationReferences';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import { setPendingAiStartPhoto } from '@/features/dashboard/marketing/lib/aiStudioHandoff';
import { findSample } from '@/features/dashboard/marketing/lib/aiStudioSamples';
import {
  AI_OUTPUT_LABEL,
  buildAiTurns,
  flattenVersions,
  isVersionInFlight,
  isVersionUsable,
  latestVersion,
  postFormatLabel,
  versionKey,
  type AiTurn,
  type AiVersion,
} from '@/features/dashboard/marketing/lib/aiStudioSessions';
import {
  composerValuesFromJob,
  fileNameForGeneratedReference,
} from '@/features/dashboard/marketing/lib/marketingGenerationComposer';
import {
  IMAGE_ASPECT_RATIO_OPTIONS,
  VIDEO_CAMERA_MOVES,
  composeGenerationPrompt,
  type VideoCameraMoveId,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import {
  DEFAULT_VIDEO_DURATION,
  estimateGenerationCredits,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import { setPendingMarketingPhoto } from '@/features/dashboard/marketing/lib/marketingPhotoHandoff';
import { useGenerateMarketingCaption } from '@/features/dashboard/marketing/lib/marketingPublishApi';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import { POSTER_GOAL_ARCHETYPES } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import {
  moreLikeThisLayouts,
  setPosterLayout,
} from '@/features/dashboard/marketing/lib/poster/posterQuickEdit';
import { POSTER_ARCHETYPE_FAMILY } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import {
  POSTER_ARCHETYPE_IDS,
  POSTER_GOALS,
  normalizePosterSpec,
  type PosterGoal,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { captureAppEvent } from '@/lib/posthog/capture';

type Props = {
  onPublish: (payload: { blob: Blob; mediaType: 'image' | 'video' }) => void;
  /** Post → open the saved design in the Posts editor. */
  onOpenInDesign: (templateId: string) => void;
  /** Reel → open the saved video in the Videos editor. */
  onOpenInVideo: (templateId: string) => void;
};

/** Formats exported by Download all sizes: portrait feed, Story and landscape. */
const ALL_SIZE_FORMATS: DesignTemplateFormat[] = [
  'instagram-portrait',
  'instagram-story',
  'facebook-post',
];

const POST_ASPECT: Record<string, string> = {
  'instagram-portrait': '4 / 5',
  'instagram-post': '1 / 1',
  'instagram-story': '9 / 16',
  'facebook-post': '40 / 21',
};

function ratioToAspect(ratio: string): string {
  const [w, h] = ratio.split(':');
  return w && h ? `${w} / ${h}` : '1 / 1';
}

function isPosterGoal(value: unknown): value is PosterGoal {
  return (POSTER_GOALS as readonly unknown[]).includes(value);
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name.replace(/[^\w.-]+/g, '-');
  link.click();
  // Revoking in the same tick can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load the file');
  return response.blob();
}

/**
 * One AI Studio creation. Before the first generate: step 2 (describe it). After: the
 * conversation, with every version in the thread on the left, the picked version
 * large on the right, and a message box to keep changing it.
 */
export function AiStudioConversation({ onPublish, onOpenInDesign, onOpenInVideo }: Props) {
  const {
    item,
    aiOutput,
    aiSampleId,
    replaceDraftWithItem,
    closeItem,
    startDraft,
    startAiSession,
    active,
  } = useMarketingTheme();
  const isBelowLg = useIsBelowLg();
  const { open: openUpgradeModal } = useUpgradeModal();
  const { canPublish } = useMarketingPermissions();
  const access = useAiOutputAccess();
  const premium = useAiPremiumFlags();
  const postGate = useFeatureGate('aiMarketingGeneration');
  const imageGate = useFeatureGate('aiMarketingImageGeneration');
  const videoGate = useFeatureGate('aiMarketingVideoGeneration');
  const planAllowed: Record<AiStudioOutput, boolean> = {
    post: postGate.isLoading || postGate.allowed,
    image: imageGate.isLoading || imageGate.allowed,
    video: videoGate.isLoading || videoGate.allowed,
    reel: postGate.isLoading || postGate.allowed,
  };

  // ── Which conversation ────────────────────────────────────────────────────
  const urlSessionId = item.mode === 'saved' ? item.id : null;
  const [createdId, setCreatedId] = useState<string | null>(null);
  const sessionId = urlSessionId ?? createdId;
  const [newOutput, setNewOutput] = useState<AiStudioOutput>(aiOutput ?? 'image');
  useEffect(() => {
    if (aiOutput) setNewOutput(aiOutput);
  }, [aiOutput]);

  // An example in the URL applies only to a new creation of the same output; anything
  // else (unknown id, another output, not ready) is dropped from the URL quietly.
  const appliedSample = useMemo(() => {
    const sample = findSample(aiSampleId);
    return sample && sample.output === newOutput ? sample : null;
  }, [aiSampleId, newOutput]);
  useEffect(() => {
    if (item.mode === 'draft' && aiSampleId && !appliedSample && aiOutput === newOutput) {
      startAiSession(newOutput, { replace: true });
    }
  }, [item.mode, aiSampleId, appliedSample, aiOutput, newOutput, startAiSession]);

  const sessionQuery = useAiSession(sessionId);
  const detail = sessionQuery.data;
  const output: AiStudioOutput = detail?.session.output ?? newOutput;
  const engine = useAiPosterEngine(detail?.session.themeKey ?? null);

  const [text, setText] = useState('');
  const [started, setStarted] = useState(false);
  const [pending, setPending] = useState<Array<AiPendingTurn & { awaitId?: string }>>([]);
  const [postWork, setPostWork] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AiVersion | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  /** A fresh batch shows as a grid until the host opens one. */
  const [gridOpen, setGridOpen] = useState(false);
  /** Set when the AI call failed and the first batch is quick layouts. */
  const [fallbackRequest, setFallbackRequest] = useState<AiCreateRequest | null>(null);
  const [refineAspect, setRefineAspect] = useState<string | null>(null);
  const [refineCamera, setRefineCamera] = useState<VideoCameraMoveId | null>(null);

  const generate = useGenerateMarketingMedia();
  const savePosts = useSavePostVersions();
  const rename = useRenameAiSession();
  const deleteVersion = useDeleteAiVersion(sessionId);
  const deleteSessions = useDeleteAiSessions();
  const referencesQuery = useMarketingGenerationReferences();
  const uploadReference = useUploadMarketingGenerationReference();

  // A post is drawn and saved in this tab; leaving mid-way would lose it.
  useUnsavedChangesGuard({ isDirty: postWork, blocksOn: 'location' });

  const turns = useMemo(() => (detail ? buildAiTurns(detail) : []), [detail]);
  const versions = useMemo(() => flattenVersions(turns), [turns]);

  // Landed versions replace their pending placeholders.
  useEffect(() => {
    if (!detail) return;
    setPending((current) => {
      const next = current.filter(
        (turn) =>
          !turn.awaitId ||
          !(
            detail.jobs.some((job) => job.id === turn.awaitId) ||
            detail.postVersions.some((row) => row.turnId === turn.awaitId)
          )
      );
      return next.length === current.length ? current : next;
    });
  }, [detail]);

  // A new version arrived: put it on stage. A batch lands best-first, so show that one.
  const seenCount = useRef(0);
  useEffect(() => {
    const added = versions.length - seenCount.current;
    if (added > 0) {
      const next = added > 1 ? versions[versions.length - added] : latestVersion(turns);
      if (next) setSelectedKey(next.key);
    }
    seenCount.current = versions.length;
  }, [versions, turns]);

  const selected =
    versions.find((version) => version.key === selectedKey) ?? latestVersion(turns) ?? null;
  const selectedIndex = selected ? versions.indexOf(selected) : -1;
  const stagePending = pending.length > 0 ? pending[pending.length - 1]! : null;
  const anyInFlight = versions.some((version) => isVersionInFlight(version));
  const busy = pending.length > 0 || generate.isPending || savePosts.isPending || postWork;

  // ── Create (step 2 → first version) ───────────────────────────────────────
  const openCreated = useCallback(
    (id: string) => {
      setCreatedId(id);
      replaceDraftWithItem(id);
    },
    [replaceDraftWithItem]
  );

  /**
   * Reel: one billed director call, saved as a version. When the AI is down for any reason
   * other than quota, the free reel (ranked photos, default lines) is saved instead.
   */
  const directAndSaveReel = async (input: {
    sessionId: string | null;
    prompt: string;
    photoUrls: string[];
    parentVersionId?: string | null;
  }): Promise<string | null> => {
    let direction: ReelDirection | null = null;
    try {
      direction = await engine.directReel({ photoUrls: input.photoUrls, prompt: input.prompt });
    } catch (error) {
      if (isAiQuotaError(error)) {
        handleGenerationError(error as Error);
        return null;
      }
    }
    // Empty picks are fine: the stage ranks the listing photos itself.
    const photoUrls = direction?.photoUrls ?? input.photoUrls;
    try {
      const saved = await savePosts.mutateAsync({
        output: 'reel',
        sessionId: input.sessionId,
        prompt: input.prompt || null,
        themeKey: engine.themeKey,
        parentVersionId: input.parentVersionId ?? null,
        versions: [
          {
            spec: {
              recipe: direction?.recipe ?? 'tour',
              copy: direction?.copy ?? { headline: '', subheadline: '', ctaLine: '' },
            },
            goal: 'vibe',
            format: 'instagram-story',
            photoUrls: photoUrls.slice(0, 6),
            previewDataUrl: null,
          },
        ],
      });
      return saved.session.id;
    } catch {
      return null;
    }
  };

  const create = async (request: AiCreateRequest) => {
    setStarted(true);
    captureAppEvent('ai_studio_generate_started', {
      output: request.output,
      sample_id: request.sampleId,
    });
    if (request.output === 'reel') {
      setPostWork(true);
      try {
        const saved = await directAndSaveReel({
          sessionId: null,
          prompt: request.prompt,
          photoUrls: request.photoUrls,
        });
        if (saved) openCreated(saved);
        else setStarted(false);
      } finally {
        setPostWork(false);
      }
      return;
    }
    if (request.output === 'post') {
      const turn: AiPendingTurn = {
        key: 'create',
        output: 'post',
        prompt: request.prompt || null,
        note: request.prompt ? null : 'New post',
        count: 4,
        aspect: POST_ASPECT[request.format] ?? '4 / 5',
      };
      setPending([turn]);
      setPostWork(true);
      try {
        // Art direction is its own call: out of credits must raise the upgrade prompt.
        const batch = await engine.generateBatch(request).catch((error: Error) => {
          handleGenerationError(error);
          return null;
        });
        if (!batch) {
          setPending([]);
          setStarted(false);
          return;
        }
        setFallbackRequest(batch.aiDirected ? null : request);
        const rendered = [];
        for (const spec of batch.specs) {
          try {
            rendered.push(await engine.render(spec, batch.photoUrls, request.format));
          } catch {
            // One layout failing to draw drops only that layout.
          }
        }
        if (rendered.length === 0) throw new Error('Could not draw these posts. Try again.');
        const saved = await savePosts.mutateAsync({
          sessionId: null,
          prompt: request.prompt || null,
          themeKey: engine.themeKey,
          versions: rendered.map((post) => ({
            spec: post.spec as unknown as Record<string, unknown>,
            goal: request.goal,
            format: post.format,
            photoUrls: post.photoUrls,
            previewDataUrl: post.previewDataUrl,
          })),
        });
        // Free extra: the best post again as a Story, saved as a second turn.
        if (request.alsoStory && batch.specs[0]) {
          try {
            const story = await engine.render(batch.specs[0], batch.photoUrls, 'instagram-story');
            await savePosts.mutateAsync({
              sessionId: saved.session.id,
              prompt: null,
              parentVersionId: saved.versions[0]?.id ?? null,
              versions: [
                {
                  spec: story.spec as unknown as Record<string, unknown>,
                  goal: request.goal,
                  format: story.format,
                  photoUrls: story.photoUrls,
                  previewDataUrl: story.previewDataUrl,
                },
              ],
            });
          } catch {
            // The Story is a bonus: the batch is already saved.
          }
        }
        setPending([]);
        setGridOpen(rendered.length > 1);
        // The grid is the first batch, even when a Story was saved after it.
        const lead = saved.versions[0];
        if (lead) setSelectedKey(versionKey('post', lead.id));
        openCreated(saved.session.id);
      } catch (error) {
        setPending([]);
        setStarted(false);
        const message = (error as Error).message;
        if (message && !/quota|credit/i.test(message)) toast.error(message);
      } finally {
        setPostWork(false);
      }
      return;
    }

    setPending([
      {
        key: 'create',
        output: request.output,
        prompt: request.prompt || null,
        note: request.prompt ? null : 'From your photo',
        count: 1,
        aspect: ratioToAspect(request.aspect),
      },
    ]);
    try {
      const { job } = await generate.mutateAsync({
        ...request.payload,
        ...(active ? { themeKey: active.key } : {}),
      });
      setPending((current) => current.map((turn) => ({ ...turn, awaitId: job.id })));
      if (job.sessionId) openCreated(job.sessionId);
    } catch (error) {
      const failed = failedJobFromError(error);
      setPending([]);
      if (failed?.sessionId) {
        openCreated(failed.sessionId);
        return;
      }
      setStarted(false);
    }
  };

  // ── Refine / new versions ─────────────────────────────────────────────────
  const firstPrompt = turns.find((turn) => turn.prompt)?.prompt ?? '';
  const library = referencesQuery.data ?? [];

  const postSpecOf = useCallback(
    (version: Extract<AiVersion, { kind: 'post' }>): PosterSpec =>
      normalizePosterSpec(version.post.spec, {
        ...engine.baseFacts,
        photos:
          version.post.photoUrls.length > 0 ? version.post.photoUrls : engine.baseFacts.photos,
      }),
    [engine.baseFacts]
  );

  const savePostVersion = async (input: {
    parent: Extract<AiVersion, { kind: 'post' }>;
    prompt: string | null;
    note: string;
    run: () => Promise<{ spec: PosterSpec; photoUrls: string[]; format: DesignTemplateFormat }>;
  }) => {
    if (!sessionId) return false;
    const format = input.parent.post.format as DesignTemplateFormat;
    setPending([
      {
        key: `turn-${Date.now()}`,
        output: 'post',
        prompt: input.prompt,
        note: input.prompt ? null : input.note,
        count: 1,
        aspect: POST_ASPECT[format] ?? '4 / 5',
      },
    ]);
    setPostWork(true);
    try {
      // The AI call is its own step: out of credits raises the upgrade prompt.
      const next = await input.run().catch((error: Error) => {
        handleGenerationError(error);
        return null;
      });
      if (!next) return false;
      const rendered = await engine.render(next.spec, next.photoUrls, next.format);
      await savePosts.mutateAsync({
        sessionId,
        prompt: input.prompt,
        parentVersionId: input.parent.post.id,
        versions: [
          {
            spec: rendered.spec as unknown as Record<string, unknown>,
            goal: isPosterGoal(input.parent.post.goal) ? input.parent.post.goal : 'vibe',
            format: rendered.format,
            photoUrls: rendered.photoUrls,
            previewDataUrl: rendered.previewDataUrl,
          },
        ],
      });
      return true;
    } catch (error) {
      // The save mutation toasts its own failures; drawing errors land here.
      if (!(error instanceof GenerationRequestError)) {
        toast.error(friendlyToastError(error, 'Could not change this post. Try again.'));
      }
      return false;
    } finally {
      setPending([]);
      setPostWork(false);
    }
  };

  const refine = async (instruction: string): Promise<boolean> => {
    if (!selected || !sessionId) return false;
    if (!planAllowed[output]) {
      openUpgradeModal(OUTPUT_FEATURE[output]);
      return false;
    }
    if (selected.kind === 'post') {
      const parent = selected;
      return savePostVersion({
        parent,
        prompt: instruction,
        note: 'Changed',
        run: async () => {
          const revised = await engine.revise({
            spec: postSpecOf(parent),
            photoUrls: parent.post.photoUrls,
            goal: isPosterGoal(parent.post.goal) ? parent.post.goal : 'vibe',
            originalPrompt: firstPrompt,
            instruction,
          });
          return { ...revised, format: parent.post.format as DesignTemplateFormat };
        },
      });
    }
    return sendJob(selected.job, instruction);
  };

  /** Photo / clip: a new job in this conversation, refining `parent`. */
  const sendJob = async (parent: MarketingGenerationJob, instruction: string, retry = false) => {
    if (!sessionId) return false;
    const values = composerValuesFromJob(parent, library, {
      allowPremium:
        parent.mediaType === 'video' ? premium.allowPremiumVideo : premium.allowPremiumImage,
      allowHighResolution: planAllowed.video,
    });
    const isVideo = parent.mediaType === 'video';
    // Retrying a failed first version resends it as it was; anything else refines the
    // version on stage (photo: edits that image; clip: same start photo).
    const refinesParent = !(retry && !parent.parentJobId);
    const parentJobId = retry ? (parent.parentJobId ?? undefined) : parent.id;
    const aspectRatio = isVideo ? values.aspectRatio : (refineAspect ?? values.aspectRatio);
    const prompt = retry
      ? refinesParent
        ? values.prompt
        : composeGenerationPrompt(values.prompt, values.lookId)
      : instruction;
    setPending([
      {
        key: `turn-${Date.now()}`,
        output: parent.mediaType,
        prompt: retry ? values.prompt || null : instruction,
        note: null,
        count: 1,
        aspect: ratioToAspect(aspectRatio),
      },
    ]);
    try {
      const { job } = await generate.mutateAsync(
        isVideo
          ? {
              mediaType: 'video',
              prompt,
              sessionId,
              ...(parentJobId ? { parentJobId } : {}),
              qualityTier: values.qualityTier,
              aspectRatio,
              resolution: values.resolution,
              durationSeconds: DEFAULT_VIDEO_DURATION,
              referenceIds: refinesParent ? [] : values.references.map((row) => row.id),
              cameraMove: refineCamera ?? values.cameraMove,
              sound: values.sound,
              enhancePrompt: true,
            }
          : {
              mediaType: 'image',
              prompt,
              sessionId,
              ...(parentJobId ? { parentJobId } : {}),
              qualityTier: values.qualityTier,
              aspectRatio,
              imageSize: values.imageSize,
              referenceIds: refinesParent ? [] : values.references.map((row) => row.id),
              enhancePrompt: true,
            }
      );
      setPending((current) => current.map((turn) => ({ ...turn, awaitId: job.id })));
      return true;
    } catch {
      setPending([]);
      void sessionQuery.refetch();
      return false;
    }
  };

  const quickEdit = async (
    version: Extract<AiVersion, { kind: 'post' }>,
    result: { spec: PosterSpec; photoUrls: string[] }
  ) => {
    captureAppEvent('ai_post_quick_edit', { layout: result.spec.archetype });
    return savePostVersion({
      parent: version,
      prompt: null,
      note: 'Edited',
      run: async () => ({
        ...result,
        format: version.post.format as DesignTemplateFormat,
      }),
    });
  };

  const shuffle = (version: Extract<AiVersion, { kind: 'post' }>) => {
    const spec = postSpecOf(version);
    const goal = isPosterGoal(version.post.goal) ? version.post.goal : spec.goal;
    const used = new Set(
      versions.flatMap((item) => (item.kind === 'post' ? [String(item.post.spec.archetype)] : []))
    );
    const order = [...POSTER_GOAL_ARCHETYPES[goal], ...POSTER_ARCHETYPE_IDS];
    const archetype =
      order.find((id) => !used.has(id)) ??
      order[(order.indexOf(spec.archetype) + 1) % order.length]!;
    void savePostVersion({
      parent: version,
      prompt: null,
      note: 'New layout',
      run: async () => ({
        spec: {
          ...spec,
          archetype,
          // In a theme the type is the theme's; only the layout changes.
          fontPairing: detail?.session.themeKey
            ? spec.fontPairing
            : POSTER_ARCHETYPE_DEFAULT_FONTS[archetype],
        },
        photoUrls: version.post.photoUrls,
        format: version.post.format as DesignTemplateFormat,
      }),
    });
  };

  /** Free: three more layouts in the same family, one new turn, no AI call. */
  const moreLikeThis = async (version: Extract<AiVersion, { kind: 'post' }>) => {
    if (!sessionId) return;
    const spec = postSpecOf(version);
    const used = new Set(
      versions.flatMap((item) => (item.kind === 'post' ? [String(item.post.spec.archetype)] : []))
    );
    const layouts = moreLikeThisLayouts(spec.archetype, used, 3);
    if (layouts.length === 0) {
      toast.message('No more layouts like this one');
      return;
    }
    const format = version.post.format as DesignTemplateFormat;
    setPending([
      {
        key: `turn-${Date.now()}`,
        output: 'post',
        prompt: null,
        note: 'More like this',
        count: layouts.length,
        aspect: POST_ASPECT[format] ?? '4 / 5',
      },
    ]);
    setPostWork(true);
    try {
      const rendered = [];
      for (const archetype of layouts) {
        try {
          rendered.push(
            await engine.render(
              setPosterLayout(spec, archetype, { keepFonts: Boolean(detail?.session.themeKey) }),
              version.post.photoUrls,
              format
            )
          );
        } catch {
          // One layout failing to draw drops only that layout.
        }
      }
      if (rendered.length === 0) throw new Error('Could not draw these posts. Try again.');
      captureAppEvent('ai_post_more_like_this', { layout: spec.archetype, count: rendered.length });
      const saved = await savePosts.mutateAsync({
        sessionId,
        prompt: null,
        parentVersionId: version.post.id,
        versions: rendered.map((post) => ({
          spec: post.spec as unknown as Record<string, unknown>,
          goal: isPosterGoal(version.post.goal) ? version.post.goal : 'vibe',
          format: post.format,
          photoUrls: post.photoUrls,
          previewDataUrl: post.previewDataUrl,
        })),
      });
      const firstNew = saved.versions[0];
      if (firstNew) setSelectedKey(versionKey('post', firstNew.id));
      setGridOpen(true);
    } catch (error) {
      if (!(error instanceof GenerationRequestError)) {
        toast.error(friendlyToastError(error, 'Could not make more posts. Try again.'));
      }
    } finally {
      setPending([]);
      setPostWork(false);
    }
  };

  /** Free: five slides, one style, rendered at 4:5 and saved as one turn. */
  const makeCarousel = async (version: Extract<AiVersion, { kind: 'post' }>) => {
    if (!sessionId) return;
    const format: DesignTemplateFormat = 'instagram-portrait';
    setPending([
      {
        key: `turn-${Date.now()}`,
        output: 'post',
        prompt: null,
        note: 'Carousel',
        count: 4,
        aspect: POST_ASPECT[format] ?? '4 / 5',
      },
    ]);
    setPostWork(true);
    try {
      const style = POSTER_ARCHETYPE_FAMILY[postSpecOf(version).archetype];
      const { slides, photoUrls } = await engine.carouselSlides(style);
      const rendered = [];
      for (const slide of slides) {
        try {
          rendered.push({
            goal: slide.spec.goal,
            post: await engine.render(slide.spec, photoUrls, format),
          });
        } catch {
          // One slide failing to draw drops only that slide.
        }
      }
      if (rendered.length < 2) throw new Error('Could not draw the carousel. Try again.');
      captureAppEvent('ai_post_carousel_made', { slides: rendered.length, family: style });
      const saved = await savePosts.mutateAsync({
        sessionId,
        prompt: null,
        parentVersionId: version.post.id,
        versions: rendered.map(({ goal, post }) => ({
          spec: post.spec as unknown as Record<string, unknown>,
          goal,
          format: post.format,
          photoUrls: post.photoUrls,
          previewDataUrl: post.previewDataUrl,
        })),
      });
      const firstNew = saved.versions[0];
      if (firstNew) setSelectedKey(versionKey('post', firstNew.id));
      setGridOpen(true);
    } catch (error) {
      if (!(error instanceof GenerationRequestError)) {
        toast.error(friendlyToastError(error, 'Could not make the carousel. Try again.'));
      }
    } finally {
      setPending([]);
      setPostWork(false);
    }
  };

  /** The slides of the open set, in order, as numbered files for posting as a carousel. */
  const downloadCarousel = (version: Extract<AiVersion, { kind: 'post' }>) =>
    withBusy('carousel', async () => {
      const turn = turns.find((item) => item.versions.some((v) => v.key === version.key));
      const slides = (turn?.versions ?? []).filter(
        (item): item is Extract<AiVersion, { kind: 'post' }> => item.kind === 'post'
      );
      for (const [index, slide] of slides.entries()) {
        downloadBlob(await blobFor(slide), `${title || 'Post'}-slide-${index + 1}.png`);
      }
      captureAppEvent('ai_studio_downloaded', { ...trackProps(version), slides: slides.length });
    });

  const downloadAllSizes = (version: Extract<AiVersion, { kind: 'post' }>) =>
    withBusy('sizes', async () => {
      const spec = postSpecOf(version);
      for (const format of ALL_SIZE_FORMATS) {
        const blob = await engine.exportBlob(spec, version.post.photoUrls, format);
        downloadBlob(blob, `${title || 'Post'}-v${version.number}-${format}.png`);
      }
      captureAppEvent('ai_studio_downloaded', { ...trackProps(version), all_sizes: true });
    });

  const resizePost = (
    version: Extract<AiVersion, { kind: 'post' }>,
    format: DesignTemplateFormat
  ) => {
    if (format === version.post.format) return;
    if (!POST_FORMATS.some((option) => option.value === format)) return;
    void savePostVersion({
      parent: version,
      prompt: null,
      note: `Resized to ${postFormatLabel(format)}`,
      run: async () => ({ spec: postSpecOf(version), photoUrls: version.post.photoUrls, format }),
    });
  };

  // ── Version actions ───────────────────────────────────────────────────────
  const withBusy = async (key: string, run: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await run();
    } catch (error) {
      toast.error(friendlyToastError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const blobFor = async (version: AiVersion): Promise<Blob> => {
    if (version.kind === 'post') {
      return engine.exportBlob(
        postSpecOf(version),
        version.post.photoUrls,
        version.post.format as DesignTemplateFormat
      );
    }
    if (!version.job.outputUrl) throw new Error('This version has no file yet');
    return fetchBlob(version.job.outputUrl);
  };

  const title = detail?.session.title ?? '';
  // Layout id and counts only: never the prompt, copy or listing data.
  const trackProps = (version: AiVersion) => ({
    output: version.kind,
    version: version.number,
    ...(version.kind === 'post' ? { layout: postSpecOf(version).archetype } : {}),
  });

  const download = (version: AiVersion) =>
    withBusy('download', async () => {
      const blob = await blobFor(version);
      captureAppEvent('ai_studio_downloaded', trackProps(version));
      const ext =
        version.kind === 'video'
          ? 'mp4'
          : version.kind === 'post'
            ? 'png'
            : (blob.type.split('/')[1] ?? 'jpg');
      downloadBlob(blob, `${title || AI_OUTPUT_LABEL[output].one}-v${version.number}.${ext}`);
    });

  const publish = (version: AiVersion) =>
    withBusy('publish', async () => {
      captureAppEvent('ai_studio_publish_started', trackProps(version));
      onPublish({
        blob: await blobFor(version),
        mediaType: version.kind === 'video' ? 'video' : 'image',
      });
    });

  const generateCaption = useGenerateMarketingCaption();
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const writeCaption = async (version: Extract<AiVersion, { kind: 'post' }>) => {
    const cached = captions[version.key];
    if (cached) return cached;
    const spec = postSpecOf(version);
    const caption = await generateCaption.mutateAsync({
      platform: 'instagram',
      postType: version.post.format === 'instagram-story' ? 'story' : 'post',
      contentHint: [spec.copy.headline, spec.copy.subhead].filter(Boolean).join('. ') || title,
    });
    setCaptions((current) => ({ ...current, [version.key]: caption }));
    return caption;
  };
  const copyCaption = (version: Extract<AiVersion, { kind: 'post' }>) =>
    withBusy('caption', async () => {
      const caption = await writeCaption(version);
      await navigator.clipboard.writeText(caption);
      captureAppEvent('ai_post_caption_copied', { layout: postSpecOf(version).archetype });
      toast.success('Caption copied');
    });

  const editInPosts = (version: Extract<AiVersion, { kind: 'post' }>) =>
    withBusy('edit', async () => {
      captureAppEvent('ai_post_edited', trackProps(version));
      const id = await engine.saveToPosts({
        spec: postSpecOf(version),
        photoUrls: version.post.photoUrls,
        format: version.post.format as DesignTemplateFormat,
        name: title || 'AI post',
        previewUrl: version.post.previewUrl,
      });
      onOpenInDesign(id);
    });

  const [reelPreviewFor, setReelPreviewFor] = useState<Extract<AiVersion, { kind: 'post' }> | null>(null);

  const makeReel = (
    version: Extract<AiVersion, { kind: 'post' }>,
    recipe?: 'tour' | 'highlights',
    direction?: ReelDirection | null
  ) =>
    withBusy('reel', async () => {
      const id = await engine.saveReel({
        photoUrls: direction?.photoUrls ?? version.post.photoUrls,
        name: title ? `${title} reel` : undefined,
        recipe,
        copy: direction?.copy,
      });
      toast.success('Reel made. Opening it in Videos');
      onOpenInVideo(id);
    });

  const reelFromClip = (job: MarketingGenerationJob) =>
    withBusy('reel', async () => {
      if (!job.outputUrl) return;
      const id = await engine.saveReel({
        leadClipUrl: job.outputUrl,
        name: title ? `${title} reel` : undefined,
      });
      toast.success('Reel made. Opening it in Videos');
      onOpenInVideo(id);
    });

  const putInPost = (job: MarketingGenerationJob) => {
    if (!job.outputUrl) return;
    setPendingMarketingPhoto(job.outputUrl);
    startDraft({ kind: 'blank' }, { tab: 'design', size: 'instagram-post' });
  };

  const makeClip = (job: MarketingGenerationJob) =>
    withBusy('clip', async () => {
      if (!job.outputUrl) return;
      const blob = await fetchBlob(job.outputUrl);
      const file = new File([blob], fileNameForGeneratedReference(job), {
        type: blob.type || job.outputMimeType || 'image/jpeg',
      });
      const reference = await uploadReference.mutateAsync(file);
      setPendingAiStartPhoto(reference);
      startAiSession('video');
    });

  // ── Render ────────────────────────────────────────────────────────────────
  const showCreate = item.mode === 'draft' && !started && !createdId;
  const notFound = sessionQuery.isError && !detail;

  if (showCreate) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ConversationTopBar
          title={`New ${AI_OUTPUT_LABEL[newOutput].one.toLowerCase()}`}
          onBack={closeItem}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-6 lg:overflow-hidden lg:p-0">
          <AiStudioCreate
            output={newOutput}
            onOutputChange={(next) => {
              setNewOutput(next);
              startAiSession(next, { replace: true });
            }}
            onSubmit={(request) => void create(request)}
            busy={busy}
            canStart={access[newOutput]}
            planAllowed={planAllowed[newOutput]}
            allowPremium={
              newOutput === 'video' ? premium.allowPremiumVideo : premium.allowPremiumImage
            }
            allowHighResolution={planAllowed.video}
            text={text}
            onTextChange={setText}
            sample={appliedSample}
            onApplySample={(sample) =>
              startAiSession(sample.output, { replace: true, sampleId: sample.id })
            }
            onClearSample={() => startAiSession(newOutput, { replace: true })}
            access={access}
          />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ConversationTopBar title="" onBack={closeItem} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-medium">This creation could not be opened.</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => void sessionQuery.refetch()}
            >
              Try again
            </Button>
            <Button type="button" className="min-h-[44px]" onClick={closeItem}>
              Back to AI Studio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (output === 'reel') {
    const reelDeleted = Boolean(detail?.session.deletedAt);
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ConversationTopBar
          title={detail?.session.title ?? ''}
          icon={<Film className="text-muted-foreground size-4 shrink-0" aria-hidden />}
          onBack={closeItem}
          onRename={
            access.reel && !reelDeleted && sessionId
              ? (next) => rename.mutateAsync({ id: sessionId, title: next })
              : undefined
          }
        />
        {detail ? (
          <AiStudioReelSession
            versions={detail.postVersions}
            engine={engine}
            canChange={access.reel && !reelDeleted}
            busy={postWork || savePosts.isPending}
            onDirect={async (prompt, parent) => {
              setPostWork(true);
              try {
                await directAndSaveReel({
                  sessionId,
                  prompt,
                  photoUrls: directionOfVersion(parent).photoUrls,
                  parentVersionId: parent.id,
                });
              } finally {
                setPostWork(false);
              }
            }}
            onEdit={async (version) => {
              const direction = directionOfVersion(version);
              await withBusy('reel', async () => {
                const id = await engine.saveReel({
                  photoUrls: direction.photoUrls,
                  name: title ? `${title} reel` : undefined,
                  recipe: direction.recipe,
                  copy: direction.copy,
                });
                toast.success('Reel made. Opening it in Videos');
                onOpenInVideo(id);
              });
            }}
            onDelete={(version) => deleteVersion.mutate({ kind: 'post', id: version.id })}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center" aria-busy="true">
            <Loader2 className="size-5 animate-spin" aria-label="Directing your reel" />
          </div>
        )}
      </div>
    );
  }

  const deleted = Boolean(detail?.session.deletedAt);
  const usable = isVersionUsable(selected);
  const canChange = access[output] && !deleted;

  const actionGroups: ResponsiveOverflowAction[][] = [];
  if (selected?.kind === 'post') {
    actionGroups.push([
      {
        key: 'shuffle',
        label: 'Try another layout',
        icon: <Shuffle className="size-4" aria-hidden />,
        disabled: busy || !canChange,
        onSelect: () => shuffle(selected),
      },
      ...(sameTurnPostCount(turns, selected) > 1
        ? [
            {
              key: 'compare',
              label: 'Compare versions',
              icon: <LayoutTemplate className="size-4" aria-hidden />,
              onSelect: () => setGridOpen(true),
            },
          ]
        : []),
      {
        key: 'more-like-this',
        label: 'More like this',
        icon: <LayoutTemplate className="size-4" aria-hidden />,
        disabled: busy || !canChange,
        onSelect: () => void moreLikeThis(selected),
      },
      {
        key: 'carousel',
        label: 'Make a carousel',
        icon: <LayoutTemplate className="size-4" aria-hidden />,
        disabled: busy || !canChange,
        onSelect: () => void makeCarousel(selected),
      },
      ...(sameTurnPostCount(turns, selected) > 2
        ? [
            {
              key: 'carousel-download',
              label: 'Download this set in order',
              icon: <Download className="size-4" aria-hidden />,
              disabled: !usable || busyAction !== null,
              onSelect: () => void downloadCarousel(selected),
            },
          ]
        : []),
      {
        key: 'reel',
        label: 'Make a reel',
        icon: <Clapperboard className="size-4" aria-hidden />,
        disabled: !usable || busyAction !== null || !access.video,
        onSelect: () => void makeReel(selected, 'tour'),
      },
      {
        key: 'reel-preview',
        label: 'Preview reel',
        icon: <Clapperboard className="size-4" aria-hidden />,
        disabled: !usable || busyAction !== null || !access.video,
        onSelect: () => setReelPreviewFor(selected),
      },
      {
        key: 'reel-short',
        label: 'Make a short reel',
        icon: <Clapperboard className="size-4" aria-hidden />,
        disabled: !usable || busyAction !== null || !access.video,
        onSelect: () => void makeReel(selected, 'highlights'),
      },
      {
        key: 'all-sizes',
        label: 'Download all sizes',
        icon: <Download className="size-4" aria-hidden />,
        disabled: !usable || busyAction !== null,
        onSelect: () => void downloadAllSizes(selected),
      },
      {
        key: 'caption',
        label: 'Copy caption',
        icon: <Copy className="size-4" aria-hidden />,
        disabled: !usable || busyAction !== null,
        onSelect: () => void copyCaption(selected),
      },
    ]);
  }
  if (selected?.kind === 'image') {
    actionGroups.push([
      {
        key: 'use-in-post',
        label: 'Use in a post',
        icon: <LayoutTemplate className="size-4" aria-hidden />,
        disabled: !usable,
        onSelect: () => putInPost(selected.job),
      },
      ...(access.video
        ? [
            {
              key: 'make-clip',
              label: 'Make a clip from this',
              icon: <Clapperboard className="size-4" aria-hidden />,
              disabled: !usable || busyAction !== null,
              onSelect: () => void makeClip(selected.job),
            },
          ]
        : []),
    ]);
  }
  if (selected?.kind === 'video') {
    actionGroups.push([
      {
        key: 'clip-in-reel',
        label: 'Use in a reel',
        icon: <Clapperboard className="size-4" aria-hidden />,
        disabled: !usable || busyAction !== null || !access.video,
        onSelect: () => void reelFromClip(selected.job),
      },
    ]);
  }
  if (
    selected &&
    selected.kind !== 'post' &&
    selected.job.promptEnhanced &&
    selected.job.enhancedPrompt
  ) {
    const enhanced = selected.job.enhancedPrompt;
    actionGroups.push([
      {
        key: 'copy',
        label: 'Copy improved description',
        icon: <Copy className="size-4" aria-hidden />,
        onSelect: () =>
          void navigator.clipboard
            .writeText(enhanced)
            .then(() => toast.success('Description copied'))
            .catch(() => toast.error('Could not copy the description')),
      },
    ]);
  }
  if (selected && canChange) {
    actionGroups.push([
      {
        key: 'delete',
        label: versions.length <= 1 ? 'Delete creation' : 'Delete this version',
        destructive: true,
        icon: <Trash2 className="size-4" aria-hidden />,
        disabled: isVersionInFlight(selected),
        onSelect: () => setConfirmDelete(selected),
      },
    ]);
  }

  const topActions = selected ? (
    <div className="flex items-center gap-1.5">
      {selected.kind === 'post' && canChange ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] gap-2 max-sm:px-3 lg:min-h-9"
          disabled={busy || !usable}
          onClick={() => setQuickEditOpen(true)}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          <span className="max-sm:sr-only">Quick edit</span>
        </Button>
      ) : null}
      {selected.kind === 'post' && canChange ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] gap-2 max-sm:px-3 lg:min-h-9"
          disabled={busyAction !== null}
          onClick={() => void editInPosts(selected)}
        >
          {busyAction === 'edit' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <PenLine className="size-4" aria-hidden />
          )}
          <span className="max-sm:sr-only">Edit in Posts</span>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 lg:size-9"
        disabled={!usable || busyAction !== null}
        onClick={() => void download(selected)}
        aria-label="Download"
      >
        {busyAction === 'download' ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
      </Button>
      {canPublish ? (
        <Button
          type="button"
          className="min-h-[44px] gap-2 max-sm:px-3 lg:min-h-9"
          disabled={!usable || busyAction !== null}
          onClick={() => void publish(selected)}
        >
          {busyAction === 'publish' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          <span className="max-sm:sr-only">Publish</span>
        </Button>
      ) : null}
      {actionGroups.length > 0 ? (
        <ResponsiveOverflowMenu
          label="More actions"
          sheetTitle={`Version ${selected.number}`}
          actionGroups={actionGroups}
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 lg:size-9"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          }
        />
      ) : null}
    </div>
  ) : null;

  const refineOptions =
    selected?.kind === 'post' && canChange ? (
      <SizeSelect
        choices={POST_FORMATS.map((option) => ({ ...option, value: option.value as string }))}
        value={selected.post.format}
        onChange={(value) => resizePost(selected, value as DesignTemplateFormat)}
        disabled={busy}
      />
    ) : selected?.kind === 'image' ? (
      <SizeSelect
        choices={IMAGE_ASPECT_RATIO_OPTIONS.map((option) => {
          const [w, h] = option.value.split(':').map(Number);
          return { value: option.value, label: option.label, width: w ?? 1, height: h ?? 1 };
        })}
        value={refineAspect ?? selected.job.aspectRatio}
        onChange={setRefineAspect}
        disabled={busy}
      />
    ) : selected?.kind === 'video' ? (
      <Select
        value={
          refineCamera ??
          (selected.job.generationOptions?.cameraMove as VideoCameraMoveId | undefined) ??
          'push-in'
        }
        onValueChange={(value) => {
          if (VIDEO_CAMERA_MOVES.some((move) => move.id === value)) {
            setRefineCamera(value as VideoCameraMoveId);
          }
        }}
        disabled={busy}
      >
        <SelectTrigger className="h-11 w-auto min-w-[8rem] lg:h-10" aria-label="Camera">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VIDEO_CAMERA_MOVES.map((move) => (
            <SelectItem key={move.id} value={move.id}>
              {move.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null;

  const refineCost =
    selected && selected.kind !== 'post'
      ? (() => {
          const job = selected.job;
          const credits =
            job.mediaType === 'video'
              ? estimateGenerationCredits({
                  mediaType: 'video',
                  tier: job.qualityTier,
                  resolution: job.resolution === '1080p' ? '1080p' : '720p',
                  durationSeconds: DEFAULT_VIDEO_DURATION,
                })
              : estimateGenerationCredits({
                  mediaType: 'image',
                  tier: job.qualityTier,
                  imageSize: job.qualityTier === 'draft' ? '1K' : ((job.imageSize ?? '1K') as '1K'),
                });
          return `${credits.toLocaleString()} credits`;
        })()
      : null;

  const blockedReason = deleted
    ? 'Restore this creation to keep working on it'
    : !access[output]
      ? 'You do not have permission to change this'
      : anyInFlight
        ? 'Wait for this clip to finish'
        : selected && selected.kind === 'image' && !usable
          ? 'This version did not finish. Pick another one'
          : null;

  const refineBox = (
    <AiStudioRefineBox
      output={output}
      onSend={refine}
      busy={busy}
      blockedReason={
        versions.length === 0
          ? pending.length > 0
            ? 'Making your first version'
            : null
          : blockedReason
      }
      feature={OUTPUT_FEATURE[output]}
      costLabel={refineCost}
      options={refineOptions}
    />
  );

  const thread = (
    <AiStudioThread
      turns={turns}
      pending={pending}
      selectedKey={selected?.key ?? null}
      onSelect={(key) => {
        setSelectedKey(key);
        setHistoryOpen(false);
      }}
    />
  );

  const gridVersions =
    gridOpen && selected?.kind === 'post' && pending.length === 0
      ? (turns
          .find((turn) => turn.versions.some((version) => version.key === selected.key))
          ?.versions.filter(
            (version): version is Extract<AiVersion, { kind: 'post' }> => version.kind === 'post'
          ) ?? [])
      : [];
  const showGrid = gridVersions.length > 1;

  const stage = showGrid ? (
    <AiStudioPostGrid
      versions={gridVersions}
      onOpen={(version) => {
        setSelectedKey(version.key);
        setGridOpen(false);
      }}
    />
  ) : (
    <AiStudioStage
      version={selected}
      pending={
        stagePending && (!selected || selectedIndex === versions.length - 1) ? stagePending : null
      }
      total={versions.length}
      onPrevious={
        selectedIndex > 0 ? () => setSelectedKey(versions[selectedIndex - 1]!.key) : undefined
      }
      onNext={
        selectedIndex >= 0 && selectedIndex < versions.length - 1
          ? () => setSelectedKey(versions[selectedIndex + 1]!.key)
          : undefined
      }
      canRetry={canChange && !busy}
      onRetry={
        selected && selected.kind !== 'post'
          ? () => void sendJob(selected.job, '', true)
          : undefined
      }
    />
  );

  const captionCard =
    selected?.kind === 'post' && usable && !showGrid ? (
      <AiStudioCaptionCard
        caption={captions[selected.key] ?? null}
        loading={generateCaption.isPending}
        disabled={!canChange}
        onWrite={() => void writeCaption(selected).catch(() => undefined)}
        onCopy={() => void copyCaption(selected)}
      />
    ) : null;

  const loadingFirst = sessionQuery.isLoading && !detail && pending.length === 0;
  const OutputIcon = AI_OUTPUT_ICON[output];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConversationTopBar
        title={title}
        icon={<OutputIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />}
        onBack={closeItem}
        onRename={
          canChange && sessionId
            ? (next) => rename.mutateAsync({ id: sessionId, title: next })
            : undefined
        }
        actions={topActions}
      />
      {fallbackRequest && !showCreate ? (
        <div
          role="status"
          className="border-border bg-muted/50 flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2 text-xs sm:px-4"
        >
          <span className="text-muted-foreground">
            AI styling was busy, so these are quick layouts.
          </span>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] shrink-0 lg:min-h-9"
            disabled={busy}
            onClick={() => {
              const request = fallbackRequest;
              setFallbackRequest(null);
              setCreatedId(null);
              void create(request);
            }}
          >
            Retry with AI
          </Button>
        </div>
      ) : null}
      {loadingFirst ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4" aria-busy="true">
          <Skeleton className="min-h-[16rem] w-full flex-1 rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-12 shrink-0 rounded-lg" />
            ))}
          </div>
        </div>
      ) : isBelowLg ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="bg-muted/40 flex min-h-0 flex-1 flex-col">
            {stage}
            {captionCard}
          </div>
          <div className="border-border space-y-2 border-t p-3">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {versions.map((version) => (
                  <VersionThumb
                    key={version.key}
                    version={version}
                    size="sm"
                    selected={version.key === selected?.key}
                    onSelect={() => setSelectedKey(version.key)}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] shrink-0 gap-1.5 px-3"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="size-4" aria-hidden />
                History
              </Button>
            </div>
            {refineBox}
          </div>
          <ResponsiveModal open={historyOpen} onOpenChange={setHistoryOpen}>
            <ResponsiveModalContent
              sheetLayout="split"
              className="flex max-h-[min(90dvh,40rem)] w-full flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 max-lg:h-[min(92dvh,40rem)] sm:p-0"
            >
              <ResponsiveModalHeader className="border-border shrink-0 border-b px-4 py-3 pr-12 sm:px-5">
                <ResponsiveModalTitle>History</ResponsiveModalTitle>
              </ResponsiveModalHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
                {thread}
              </div>
            </ResponsiveModalContent>
          </ResponsiveModal>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(20rem,22.5rem)_minmax(0,1fr)]">
          <aside className="border-border flex min-h-0 flex-col border-r" aria-label="Versions">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{thread}</div>
            <div className="border-border border-t p-3">{refineBox}</div>
          </aside>
          <section className="bg-muted/40 flex min-h-0 flex-col" aria-label="Preview">
            {stage}
            {captionCard}
          </section>
        </div>
      )}

      {reelPreviewFor ? (
        <AiStudioReelPreview
          open
          onOpenChange={(open) => {
            if (!open) setReelPreviewFor(null);
          }}
          engine={engine}
          photoUrls={reelPreviewFor.post.photoUrls}
          onEdit={async (recipe, direction) => {
            const version = reelPreviewFor;
            setReelPreviewFor(null);
            await makeReel(version, recipe, direction);
          }}
        />
      ) : null}

      {quickEditOpen && selected?.kind === 'post' ? (
        <AiStudioQuickEdit
          key={selected.key}
          open
          onOpenChange={setQuickEditOpen}
          spec={postSpecOf(selected)}
          photoUrls={selected.post.photoUrls}
          libraryPhotos={engine.baseFacts.photos}
          available={{
            logo: Boolean(engine.baseFacts.logoUrl),
            infoBar: Boolean(engine.baseFacts.checkIn || engine.baseFacts.checkOut),
            location: Boolean(engine.baseFacts.location),
          }}
          keepFonts={Boolean(detail?.session.themeKey)}
          saving={busy}
          onApply={(result) => quickEdit(selected, result)}
        />
      ) : null}

      <AlertDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent className="max-w-[min(calc(100vw-1.5rem),24rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {versions.length <= 1
                ? 'Delete this creation?'
                : `Delete version ${confirmDelete?.number}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {versions.length <= 1
                ? 'It moves to Recently deleted for 30 days.'
                : 'This version is removed for good. Posts you already published stay up.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = confirmDelete;
                setConfirmDelete(null);
                if (!target || !sessionId) return;
                if (versions.length <= 1) {
                  deleteSessions.mutate({ ids: [sessionId] }, { onSuccess: () => closeItem() });
                  return;
                }
                deleteVersion.mutate({
                  kind: target.kind,
                  id: target.kind === 'post' ? target.post.id : target.job.id,
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function sameTurnPostCount(turns: AiTurn[], selected: AiVersion): number {
  const turn = turns.find((item) => item.versions.some((version) => version.key === selected.key));
  return turn ? turn.versions.filter((version) => version.kind === 'post').length : 0;
}

function ConversationTopBar({
  title,
  icon,
  onBack,
  onRename,
  actions,
}: {
  title: string;
  icon?: React.ReactNode;
  onBack: () => void;
  onRename?: (title: string) => Promise<unknown>;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card shrink-0 border-b">
      <div className="flex min-h-[52px] items-center gap-1 px-1.5 py-1 sm:gap-2 sm:px-3">
        <Button
          type="button"
          variant="ghost"
          className="min-h-[44px] shrink-0 gap-1 px-2"
          onClick={onBack}
          aria-label="Back to AI Studio"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="max-sm:sr-only">AI Studio</span>
        </Button>
        <span className="bg-border hidden h-5 w-px sm:block" aria-hidden />
        <div className="flex min-w-0 items-center gap-1.5">
          {icon}
          {title ? (
            <MarketingInlineName
              name={title}
              onRename={onRename}
              className="max-w-[min(22rem,45vw)]"
            />
          ) : (
            <Skeleton className="h-5 w-40" />
          )}
        </div>
        <div className="ml-auto flex items-center">{actions}</div>
      </div>
    </div>
  );
}
