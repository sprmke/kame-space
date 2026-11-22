import { describe, expect, it } from 'vitest';

import {
  isAudiusStreamUrl,
  isCatalogStreamUrl,
  isJamendoStreamUrl,
  videoMusicFromJamendoTrack,
  findJamendoTrackForMusic,
  applyImportedVideoMusic,
} from '@/features/dashboard/marketing/lib/video/importVideoMusic';

describe('isJamendoStreamUrl', () => {
  it('isJamendoStreamUrl is exported', () => {
    expect(typeof isJamendoStreamUrl).toBe('function');
  });
});

describe('videoMusicFromJamendoTrack', () => {
  it('videoMusicFromJamendoTrack is exported', () => {
    expect(typeof videoMusicFromJamendoTrack).toBe('function');
  });
});

describe('findJamendoTrackForMusic', () => {
  it('findJamendoTrackForMusic is exported', () => {
    expect(typeof findJamendoTrackForMusic).toBe('function');
  });
});

describe('applyImportedVideoMusic', () => {
  it('applyImportedVideoMusic is exported', () => {
    expect(typeof applyImportedVideoMusic).toBe('function');
  });
});

describe('stream url detection', () => {
  it('recognises the stable Audius stream endpoint only', () => {
    expect(isAudiusStreamUrl('https://api.audius.co/v1/tracks/V66vyPP/stream?app_name=x')).toBe(
      true
    );
    expect(isAudiusStreamUrl('https://api.audius.co/v1/tracks/trending')).toBe(false);
    expect(isAudiusStreamUrl('https://evil.example/v1/tracks/V66vyPP/stream')).toBe(false);
    expect(isAudiusStreamUrl('nonsense')).toBe(false);
    expect(isAudiusStreamUrl(null)).toBe(false);
  });

  it('treats Jamendo and Audius streams as catalog streams, Storage urls as not', () => {
    expect(isCatalogStreamUrl('https://prod-1.storage.jamendo.com/?trackid=1')).toBe(true);
    expect(isCatalogStreamUrl('https://api.audius.co/v1/tracks/a/stream')).toBe(true);
    expect(isCatalogStreamUrl('https://proj.supabase.co/storage/v1/object/public/x.mp3')).toBe(
      false
    );
    expect(isCatalogStreamUrl('')).toBe(false);
  });
});
