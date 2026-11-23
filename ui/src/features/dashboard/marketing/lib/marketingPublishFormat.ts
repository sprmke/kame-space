import type { InstagramSong } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

export type PublishPlatform = 'facebook' | 'instagram';
export type PublishFormat = 'post' | 'reel' | 'story';
export type PublishMediaType = 'image' | 'video';

export type PublishFormatOption = { value: PublishFormat; label: string; disabled?: boolean };

/**
 * Formats a destination offers. Instagram has no plain video post any more: a video there is a
 * Reel, so a video offers Reel and Story and a photo offers Post and Story.
 */
export function publishFormatOptions(
  platform: PublishPlatform,
  mediaType: PublishMediaType
): PublishFormatOption[] {
  if (platform === 'instagram' && mediaType === 'video') {
    return [
      { value: 'reel', label: 'Reel' },
      { value: 'story', label: 'Story' },
    ];
  }
  return [
    { value: 'post', label: 'Post' },
    // Facebook Stories are not supported for video yet.
    { value: 'story', label: 'Story', disabled: platform === 'facebook' && mediaType === 'video' },
  ];
}

/** The format that will actually be sent: a choice the destination does not offer is corrected. */
export function resolvePublishFormat(
  format: PublishFormat,
  platform: PublishPlatform,
  mediaType: PublishMediaType
): PublishFormat {
  const options = publishFormatOptions(platform, mediaType).filter((o) => !o.disabled);
  if (options.some((o) => o.value === format)) return format;
  return options[0]?.value ?? 'post';
}

/** Instagram adds a song only to a video posted as an Instagram Reel. */
export function instagramSongApplies(
  platform: PublishPlatform,
  format: PublishFormat,
  mediaType: PublishMediaType,
  song: InstagramSong | null | undefined
): boolean {
  return Boolean(song) && platform === 'instagram' && format === 'reel' && mediaType === 'video';
}

export type InstagramAudioPayload = { audioId: string; audioVolume: number };

export function instagramAudioPayload(
  song: InstagramSong | null | undefined,
  applies: boolean
): InstagramAudioPayload | undefined {
  if (!song || !applies) return undefined;
  return { audioId: song.audioId, audioVolume: song.volume };
}

/** The caption suggester only knows posts and stories. */
export function captionPostType(format: PublishFormat): 'post' | 'story' {
  return format === 'story' ? 'story' : 'post';
}
