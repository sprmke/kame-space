import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Music, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { fetchInboxConnections } from '@/features/dashboard/inbox/lib/inboxApi';
import type { InboxConnection } from '@/features/dashboard/inbox/types/inbox';
import { useMarketingBookedDates } from '@/features/dashboard/marketing/hooks/useMarketingBookedDates';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import { availabilityTextForMonth } from '@/features/dashboard/marketing/lib/marketingBookedDates';
import {
  publishBatchToMeta,
  publishToMetaRequest,
  useGenerateMarketingCaption,
} from '@/features/dashboard/marketing/lib/marketingPublishApi';
import {
  captionPostType,
  instagramAudioPayload,
  instagramSongApplies,
  publishFormatOptions,
  resolvePublishFormat,
  type PublishFormat,
} from '@/features/dashboard/marketing/lib/marketingPublishFormat';
import { MARKETING_PUBLISH_META_LABEL } from '@/features/dashboard/marketing/lib/marketingStudioCopy';
import type { InstagramSong } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import {
  useOrgIdParam,
  useOrgSlugParam,
  usePropertyIdParam,
} from '@/features/dashboard/org/lib/adminApiScope';
import { isAiQuotaError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { propertyInboxPath } from '@/features/dashboard/org/lib/tenantPaths';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { MarketingAiLegalNotice } from '@/components/legal/LegalNoticePresets';
import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { UPLOAD_MAX_BYTES, formatMaxBytesError } from '@/lib/media/uploadLimits';
import { captureAppEvent } from '@/lib/posthog/capture';
import { formatMoneyCompact } from '@/utils/format/currency';

export type PublishMedia = {
  blob?: Blob;
  dataUrl?: string;
  mediaType: 'image' | 'video';
  templateId?: string;
  /** The song Instagram adds when a video is posted as a Reel. */
  instagramSong?: InstagramSong;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: PublishMedia | null;
};

function connectedMetaChannels(connections: InboxConnection[]) {
  return connections.filter(
    (c) =>
      (c.platform === 'facebook' || c.platform === 'instagram') &&
      c.status === 'connected' &&
      !c.isPreview
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Decoded byte size of a `data:` URL without materialising the bytes. */
function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return 0;
  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (!meta.includes('base64')) return body.length;
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  return Math.floor((body.length * 3) / 4) - padding;
}

export function PublishDialog({ open, onOpenChange, media }: Props) {
  const { orgSlug, property } = useOrgContext();
  const orgId = useOrgIdParam();
  const routeOrgSlug = useOrgSlugParam();
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  const [platform, setPlatform] = useState<'facebook' | 'instagram'>('facebook');
  const [format, setFormat] = useState<PublishFormat>('post');
  const [connectionIds, setConnectionIds] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const generateCaption = useGenerateMarketingCaption();
  const { data: publicProperty } = usePublicPropertyDetail(property.slug);
  const { data: bookedDates } = useMarketingBookedDates();
  const { canPublish: canPublishPermission } = useMarketingPermissions();
  const { canUse: canPublishMarketing, isLoading: entitlementsLoading } = useFeatureGate(
    'marketingPublishLimitPerGroup'
  );
  const { open: openUpgradeModal } = useUpgradeModal();

  const connectionsQuery = useQuery({
    queryKey: ['meta-publish-connections', routeOrgSlug ?? orgSlug, orgId, propertyId],
    queryFn: () =>
      fetchInboxConnections(routeOrgSlug ?? orgSlug, orgId, propertyId ? { propertyId } : null),
    enabled: open && !!propertyId,
    staleTime: 30_000,
  });

  const channels = useMemo(
    () => connectedMetaChannels(connectionsQuery.data?.connections ?? []),
    [connectionsQuery.data?.connections]
  );

  const platformChannels = useMemo(
    () => channels.filter((c) => c.platform === platform),
    [channels, platform]
  );

  const mediaType = media?.mediaType ?? 'image';
  const postType = resolvePublishFormat(format, platform, mediaType);
  const formatOptions = publishFormatOptions(platform, mediaType);
  const song = media?.instagramSong ?? null;
  const songApplies = instagramSongApplies(platform, postType, mediaType, song);
  const hasInstagramChannel = channels.some((c) => c.platform === 'instagram');

  // A video with an Instagram song is meant for a Reel: start there once Instagram is known.
  const songId = song?.audioId;
  useEffect(() => {
    if (!open || !songId || !hasInstagramChannel) return;
    setPlatform('instagram');
    setFormat('reel');
  }, [open, songId, hasInstagramChannel]);

  useEffect(() => {
    if (!open) return;
    const first = platformChannels[0];
    setConnectionIds(first ? [first.id] : []);
  }, [open, platform, platformChannels]);

  const toggleConnection = (id: string, checked: boolean) => {
    setConnectionIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((item) => item !== id);
    });
  };

  const handleSuggestCaption = async () => {
    const rate = publicProperty?.pricing.baseRate ?? 2799;
    const captionText = await generateCaption.mutateAsync({
      platform,
      postType: captionPostType(postType),
      contentHint: media?.templateId,
      nightlyRate: `${formatMoneyCompact(rate)} / night`,
      availabilityText: availabilityTextForMonth(bookedDates ?? [], new Date()),
    });
    setCaption(captionText);
    captureAppEvent('marketing_caption_generated', {
      platform,
      post_type: postType,
      media_type: media?.mediaType ?? 'unknown',
    });
  };

  const handlePublish = async () => {
    if (!media || connectionIds.length === 0) return;
    if (!canPublishPermission) return;

    if (!canPublishMarketing) {
      if (!entitlementsLoading) openUpgradeModal('marketingPublishLimitPerGroup');
      return;
    }

    let mediaUrl = media.dataUrl ?? '';
    if (!mediaUrl && media.blob) {
      mediaUrl = await blobToDataUrl(media.blob);
    }
    if (!mediaUrl) return;

    // Bound the image payload (plan §16 Phase 3). Designs export as bounded JPEG;
    // this catches a still-oversized calendar export (e.g. PNG at 2×) before it
    // hits Meta with a friendly message instead of a generic Graph API failure.
    if (media.mediaType === 'image') {
      const bytes = media.blob?.size ?? dataUrlByteLength(mediaUrl);
      if (bytes > UPLOAD_MAX_BYTES.image) {
        toast.error(
          `${formatMaxBytesError(UPLOAD_MAX_BYTES.image)}. Export as JPEG to publish this design.`
        );
        return;
      }
    }

    if (media.mediaType === 'video' && platform === 'facebook') {
      toast.error('Facebook video publishing is not supported yet');
      return;
    }

    setPublishing(true);
    try {
      const payloads = connectionIds.map((connectionId) => ({
        platform,
        postType,
        caption: caption.trim(),
        connectionId,
        mediaType: media.mediaType,
        mediaUrl,
        templateId: media.templateId,
        instagramAudio: instagramAudioPayload(song, songApplies),
      }));

      let publishedCount = 1;
      let failedCount = 0;
      if (batchMode && payloads.length > 1) {
        const results = await publishBatchToMeta(propertyId, payloads);
        publishedCount = results.length;
        failedCount = results.filter((r) => !r.ok).length;
        if (failedCount === 0) {
          toast.success(`Published to ${publishedCount} channels`);
        } else {
          toast.error(`${failedCount} of ${publishedCount} publishes failed`);
        }
      } else {
        await publishToMetaRequest(propertyId, payloads[0]!);
        toast.success('Published');
      }
      captureAppEvent('marketing_post_published', {
        platform,
        post_type: postType,
        media_type: media.mediaType,
        has_instagram_song: songApplies,
        channel_count: connectionIds.length,
        batch_mode: batchMode,
        published_count: publishedCount,
        failed_count: failedCount,
      });

      void queryClient.invalidateQueries({ queryKey: ['marketing-publications', propertyId] });
      onOpenChange(false);
    } catch (error) {
      if (isAiQuotaError(error)) {
        openUpgradeModal(error.feature ?? 'marketingPublishLimitPerGroup');
        return;
      }
      captureAppEvent('marketing_publish_failed', {
        platform,
        post_type: postType,
        media_type: media.mediaType,
      });
      toast.error((error as Error).message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="flex max-h-[min(90dvh,36rem)] max-w-[min(calc(100vw-1.5rem),28rem)] flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 sm:p-0"
      >
        <ResponsiveModalHeader className="shrink-0 px-4 pt-6">
          <ResponsiveModalTitle>{MARKETING_PUBLISH_META_LABEL}</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {connectionsQuery.isLoading ? (
            <ListRowsSkeleton rows={3} label="Loading connections" className="min-h-[120px]" />
          ) : channels.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Connect Facebook or Instagram in{' '}
              <Link
                to={propertyInboxPath(orgSlug, property.slug)}
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => onOpenChange(false)}
              >
                Inbox
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={platform}
                  onValueChange={(v) => setPlatform(v as 'facebook' | 'instagram')}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook Page</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{batchMode ? 'Accounts' : 'Account'}</Label>
                {batchMode ? (
                  <ul className="max-h-[240px] space-y-2 overflow-y-auto">
                    {platformChannels.map((conn) => (
                      <li key={conn.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`conn-${conn.id}`}
                          checked={connectionIds.includes(conn.id)}
                          onCheckedChange={(checked) => toggleConnection(conn.id, checked === true)}
                        />
                        <Label htmlFor={`conn-${conn.id}`} className="font-normal">
                          {conn.displayName ?? conn.platform}
                        </Label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Select
                    value={connectionIds[0] ?? ''}
                    onValueChange={(v) => setConnectionIds([v])}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {platformChannels.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.displayName ?? conn.platform}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="batch-mode"
                  checked={batchMode}
                  onCheckedChange={(checked) => setBatchMode(checked === true)}
                />
                <Label htmlFor="batch-mode" className="font-normal">
                  Batch publish
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <RadioGroup
                  value={postType}
                  onValueChange={(v) => setFormat(v as PublishFormat)}
                  className="flex gap-4"
                >
                  {formatOptions.map((option) => (
                    <div key={option.value} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={option.value}
                        id={`publish-${option.value}`}
                        disabled={option.disabled}
                      />
                      <Label htmlFor={`publish-${option.value}`} className="font-normal">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {song ? (
                <div
                  className="border-border flex items-center gap-3 rounded-lg border p-2"
                  data-testid="publish-instagram-song"
                >
                  <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
                    {song.imageUrl ? (
                      <img src={song.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Music className="size-4" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{song.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {songApplies
                        ? 'Instagram adds this song to your Reel'
                        : 'Only added when you post to Instagram as a Reel'}
                    </p>
                  </div>
                  {!songApplies && hasInstagramChannel ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] shrink-0"
                      onClick={() => {
                        setPlatform('instagram');
                        setFormat('reel');
                      }}
                    >
                      Use Reel
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="publish-caption">Caption</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] gap-1"
                    disabled={generateCaption.isPending}
                    onClick={() => void handleSuggestCaption()}
                  >
                    {generateCaption.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="size-4" aria-hidden />
                    )}
                    Suggest
                  </Button>
                </div>
                <Textarea
                  id="publish-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  className="min-h-[88px]"
                />
              </div>
              <MarketingAiLegalNotice />
            </div>
          )}
        </div>

        <ResponsiveModalFooter className="shrink-0 gap-2 px-4 pb-6 pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <TierBadgeAnchor feature="marketingPublishLimitPerGroup">
            <Button
              type="button"
              className="gap-2"
              disabled={
                !media ||
                connectionIds.length === 0 ||
                publishing ||
                channels.length === 0 ||
                connectionsQuery.isLoading
              }
              onClick={() => void handlePublish()}
            >
              {publishing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {MARKETING_PUBLISH_META_LABEL}
            </Button>
          </TierBadgeAnchor>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
