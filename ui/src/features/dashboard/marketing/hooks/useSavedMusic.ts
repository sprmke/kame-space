import { useCallback, useEffect, useState } from 'react';

import {
  musicTrackKey,
  type MusicTrack,
} from '@/features/dashboard/marketing/lib/music/musicTypes';

const MAX_SAVED = 50;

function storageKey(propertyId: string | null): string {
  return `kame:marketing-music-saved:${propertyId ?? 'none'}`;
}

function isSavable(value: unknown): value is MusicTrack {
  if (!value || typeof value !== 'object') return false;
  const t = value as Partial<MusicTrack>;
  return (
    typeof t.id === 'string' &&
    (t.source === 'jamendo' || t.source === 'audius') &&
    typeof t.title === 'string' &&
    typeof t.artist === 'string' &&
    typeof t.streamUrl === 'string' &&
    t.exportable === true
  );
}

/** Reads the saved list. Anything malformed or unreadable is dropped, never thrown. */
export function readSavedMusic(propertyId: string | null): MusicTrack[] {
  try {
    const raw = window.localStorage.getItem(storageKey(propertyId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavable).slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

function writeSavedMusic(propertyId: string | null, tracks: MusicTrack[]): void {
  try {
    window.localStorage.setItem(storageKey(propertyId), JSON.stringify(tracks));
  } catch {
    // Private windows and full storage can refuse. Saving is a convenience, not required.
  }
}

/**
 * Tracks the host bookmarked, kept in this browser per property. Instagram songs are not saved:
 * their preview links expire and the catalog changes.
 */
export function useSavedMusic(propertyId: string | null) {
  const [tracks, setTracks] = useState<MusicTrack[]>(() => readSavedMusic(propertyId));

  useEffect(() => {
    setTracks(readSavedMusic(propertyId));
  }, [propertyId]);

  const isSaved = useCallback(
    (track: MusicTrack) => tracks.some((t) => musicTrackKey(t) === musicTrackKey(track)),
    [tracks]
  );

  const toggle = useCallback(
    (track: MusicTrack) => {
      if (!isSavable(track)) return;
      setTracks((prev) => {
        const key = musicTrackKey(track);
        const next = prev.some((t) => musicTrackKey(t) === key)
          ? prev.filter((t) => musicTrackKey(t) !== key)
          : [track, ...prev].slice(0, MAX_SAVED);
        writeSavedMusic(propertyId, next);
        return next;
      });
    },
    [propertyId]
  );

  return { tracks, isSaved, toggle };
}
