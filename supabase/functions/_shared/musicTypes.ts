/**
 * One track shape for every music source in the video editor picker.
 *
 * `jamendo` and `audius` tracks are full songs the editor can trim, loop and bake into an export.
 * `instagram` tracks are licensed by Meta: the editor only previews them, and Instagram adds the
 * song when the video is posted as a Reel.
 */

export type MusicSource = 'jamendo' | 'audius' | 'instagram';

export type MusicTrack = {
  /** Id inside its own source. Unique only together with `source`. */
  id: string;
  source: MusicSource;
  title: string;
  artist: string;
  durationSec: number;
  imageUrl: string | null;
  /** Playable URL for previews and the editor. Null when the source gave no preview. */
  streamUrl: string | null;
  /** True when the song can be baked into an exported video. Instagram songs cannot. */
  exportable: boolean;
  genre?: string | null;
  mood?: string | null;
};

export type MusicSourceStatus = 'ok' | 'off' | 'error';

/** Strips a trailing audio file extension some uploaders leave in the title. */
export function cleanTrackTitle(raw: string): string {
  const title = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.(wav|mp3|flac|m4a|aiff?|ogg)$/i, '')
    .trim();
  return title || 'Untitled';
}

/** Lowercase letters and digits only. Used to spot the same song from two sources. */
export function trackFingerprint(track: Pick<MusicTrack, 'title' | 'artist'>): string {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${norm(track.title)}|${norm(track.artist)}`;
}

/** Alternate between sources so no single catalog fills the first screen. */
export function interleaveTracks(lists: MusicTrack[][]): MusicTrack[] {
  const out: MusicTrack[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let i = 0; i < longest; i += 1) {
    for (const list of lists) {
      const track = list[i];
      if (!track) continue;
      const key = trackFingerprint(track);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(track);
    }
  }
  return out;
}
