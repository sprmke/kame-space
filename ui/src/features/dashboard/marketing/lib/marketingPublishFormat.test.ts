import { describe, expect, it } from 'vitest';

import {
  captionPostType,
  instagramAudioPayload,
  instagramSongApplies,
  publishFormatOptions,
  resolvePublishFormat,
} from '@/features/dashboard/marketing/lib/marketingPublishFormat';
import type { InstagramSong } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

const SONG: InstagramSong = {
  audioId: '1234',
  title: 'Golden Hour',
  artist: 'JVKE',
  imageUrl: null,
  durationSec: 209,
  volume: 70,
};

describe('publishFormatOptions', () => {
  it('offers Reel and Story for an Instagram video', () => {
    expect(publishFormatOptions('instagram', 'video').map((o) => o.value)).toEqual([
      'reel',
      'story',
    ]);
  });

  it('offers Post and Story for a photo', () => {
    expect(publishFormatOptions('instagram', 'image').map((o) => o.value)).toEqual([
      'post',
      'story',
    ]);
    expect(publishFormatOptions('facebook', 'image').every((o) => !o.disabled)).toBe(true);
  });

  it('disables a Facebook video story', () => {
    const story = publishFormatOptions('facebook', 'video').find((o) => o.value === 'story');
    expect(story?.disabled).toBe(true);
  });
});

describe('resolvePublishFormat', () => {
  it('turns a video Post into a Reel on Instagram', () => {
    expect(resolvePublishFormat('post', 'instagram', 'video')).toBe('reel');
  });

  it('turns a Reel on a photo or on Facebook back into a Post', () => {
    expect(resolvePublishFormat('reel', 'instagram', 'image')).toBe('post');
    expect(resolvePublishFormat('reel', 'facebook', 'image')).toBe('post');
  });

  it('keeps a valid choice and skips a disabled one', () => {
    expect(resolvePublishFormat('story', 'instagram', 'video')).toBe('story');
    expect(resolvePublishFormat('story', 'facebook', 'video')).toBe('post');
  });
});

describe('Instagram song', () => {
  it('applies only to an Instagram Reel of a video', () => {
    expect(instagramSongApplies('instagram', 'reel', 'video', SONG)).toBe(true);
    expect(instagramSongApplies('instagram', 'story', 'video', SONG)).toBe(false);
    expect(instagramSongApplies('facebook', 'reel', 'video', SONG)).toBe(false);
    expect(instagramSongApplies('instagram', 'reel', 'image', SONG)).toBe(false);
    expect(instagramSongApplies('instagram', 'reel', 'video', null)).toBe(false);
  });

  it('sends the id and volume only when it applies', () => {
    expect(instagramAudioPayload(SONG, true)).toEqual({ audioId: '1234', audioVolume: 70 });
    expect(instagramAudioPayload(SONG, false)).toBeUndefined();
    expect(instagramAudioPayload(undefined, true)).toBeUndefined();
  });
});

describe('captionPostType', () => {
  it('maps Reel to post and keeps story', () => {
    expect(captionPostType('reel')).toBe('post');
    expect(captionPostType('story')).toBe('story');
    expect(captionPostType('post')).toBe('post');
  });
});
