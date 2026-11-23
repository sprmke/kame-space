import { describe, expect, it } from 'vitest';

import { payloadFromTrack } from '@/features/dashboard/marketing/lib/media/musicPayload';
import type { MusicTrack } from '@/features/dashboard/marketing/lib/music/musicTypes';

function track(over: Partial<MusicTrack> = {}): MusicTrack {
  return {
    id: '42',
    source: 'jamendo',
    title: 'Lofi',
    artist: 'Joystock',
    durationSec: 93.4,
    imageUrl: null,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=42',
    exportable: true,
    ...over,
  };
}

describe('payloadFromTrack', () => {
  it('turns a Jamendo track into an audio clip payload with its credit', () => {
    expect(payloadFromTrack(track())).toMatchObject({
      kind: 'audio',
      source: 'jamendo',
      assetId: null,
      durationMs: 93_400,
      title: 'Lofi',
      artist: 'Joystock',
      trackId: '42',
    });
  });

  it('keeps Audius as its own source so export can cache it', () => {
    expect(
      payloadFromTrack(
        track({
          id: 'V66vyPP',
          source: 'audius',
          streamUrl: 'https://api.audius.co/v1/tracks/V66vyPP/stream?app_name=x',
        })
      )
    ).toMatchObject({ source: 'audius', trackId: 'V66vyPP' });
  });

  it('leaves the length open when the track reports none', () => {
    expect(payloadFromTrack(track({ durationSec: 0 }))?.durationMs).toBeNull();
  });

  it('refuses Instagram songs and tracks without a stream', () => {
    expect(payloadFromTrack(track({ source: 'instagram', exportable: false }))).toBeNull();
    expect(payloadFromTrack(track({ streamUrl: null }))).toBeNull();
  });
});
