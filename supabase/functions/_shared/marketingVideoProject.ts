/**
 * Server-side checks for a saved Videos project (`marketing_templates.design_json` with
 * `content_type = 'video'`). Mirrors `VIDEO_V2_LIMITS` in
 * `ui/src/features/dashboard/marketing/lib/video/v2/videoProjectV2Types.ts`.
 *
 * Deliberately conservative: it enforces size, structure and counts, and rejects URL schemes that
 * could run code or smuggle bytes (`data:`, `blob:`, `javascript:`, `file:`). It does NOT enforce
 * a host allowlist yet: saved projects hold property photos, org logos, AI results, library files
 * and free-music streams, and rejecting a legitimate save would break autosave. Tracked as a
 * follow-up in docs/workflow/in-progress/marketing-video-editor-multitrack.md.
 *
 * Plan: docs/workflow/in-progress/marketing-video-editor-mobile-first-refine.md §6, T5.0.
 */

export const VIDEO_PROJECT_LIMITS = {
  /** `design_json` size after the thumbnail is split off. */
  maxBytes: 512 * 1024,
  maxTracks: 10,
  /** Clips, text and audio. Caption lines are counted separately. */
  maxItems: 150,
  maxCaptionItems: 200,
  maxDurationFrames: 60 * 30,
  maxCaptionWords: 100,
  maxCaptionTextLength: 200,
  /** v1 scene projects. */
  maxScenes: 40,
} as const;

export type VideoProjectIssue =
  | 'not_object'
  | 'too_large'
  | 'bad_version'
  | 'bad_tracks'
  | 'too_many_tracks'
  | 'too_many_items'
  | 'too_many_captions'
  | 'too_long'
  | 'bad_caption'
  | 'bad_url';

export type VideoProjectCheck =
  | { ok: true }
  | {
      ok: false;
      code: VideoProjectIssue;
      message: string;
    };

const MESSAGES: Record<VideoProjectIssue, string> = {
  not_object: 'The video could not be saved.',
  too_large: 'This video has too much in it to save. Remove some clips or text.',
  bad_version: 'This video was made with a version we cannot save.',
  bad_tracks: 'This video could not be saved because its layers are not valid.',
  too_many_tracks: 'A video can have up to 10 layers.',
  too_many_items: 'A video can have up to 150 clips.',
  too_many_captions: 'A video can have up to 200 caption lines.',
  too_long: 'Videos can be up to 60 seconds long.',
  bad_caption: 'A caption line is too long. Shorten it and try again.',
  bad_url: 'This video uses a file we cannot save. Add it again from Your media.',
};

const fail = (code: VideoProjectIssue): VideoProjectCheck => ({
  ok: false,
  code,
  message: MESSAGES[code],
});

const BLOCKED_SCHEME = /^\s*(data|blob|javascript|file|vbscript):/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when any `*Url` string in the tree uses a scheme we never store. */
export function hasBlockedUrl(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (Array.isArray(value)) {
    return value.some((entry) => hasBlockedUrl(entry, depth + 1));
  }
  if (!isRecord(value)) return false;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && /url$/i.test(key) && BLOCKED_SCHEME.test(entry)) return true;
    if (typeof entry === 'object' && entry !== null && hasBlockedUrl(entry, depth + 1)) return true;
  }
  return false;
}

function byteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function itemEnd(item: Record<string, unknown>): number {
  const from = typeof item.from === 'number' && Number.isFinite(item.from) ? item.from : 0;
  const duration =
    typeof item.durationInFrames === 'number' && Number.isFinite(item.durationInFrames)
      ? item.durationInFrames
      : 0;
  return from + duration;
}

/** Validate a video `design_json`. `v1` scene projects get the size and URL checks only. */
export function validateVideoDesignJson(designJson: unknown): VideoProjectCheck {
  if (!isRecord(designJson)) return fail('not_object');
  // An empty object is a brand new draft that has not been edited yet.
  if (Object.keys(designJson).length === 0) return { ok: true };
  if (byteLength(designJson) > VIDEO_PROJECT_LIMITS.maxBytes) {
    return fail('too_large');
  }
  if (hasBlockedUrl(designJson)) return fail('bad_url');

  const version = designJson.version;
  if (version === undefined || version === 1) {
    const scenes = designJson.scenes;
    if (
      scenes !== undefined &&
      (!Array.isArray(scenes) || scenes.length > VIDEO_PROJECT_LIMITS.maxScenes)
    ) {
      return fail('bad_tracks');
    }
    return { ok: true };
  }
  if (version !== 2) return fail('bad_version');

  const tracks = designJson.tracks;
  if (!Array.isArray(tracks) || tracks.length === 0) return fail('bad_tracks');
  if (tracks.length > VIDEO_PROJECT_LIMITS.maxTracks) {
    return fail('too_many_tracks');
  }

  let items = 0;
  let captions = 0;
  let endFrame = 0;
  for (const track of tracks) {
    if (!isRecord(track) || !Array.isArray(track.items)) {
      return fail('bad_tracks');
    }
    for (const item of track.items) {
      if (!isRecord(item)) return fail('bad_tracks');
      if (item.type === 'caption') {
        captions += 1;
        if (
          typeof item.text === 'string' &&
          item.text.length > VIDEO_PROJECT_LIMITS.maxCaptionTextLength
        ) {
          return fail('bad_caption');
        }
        if (Array.isArray(item.words) && item.words.length > VIDEO_PROJECT_LIMITS.maxCaptionWords) {
          return fail('bad_caption');
        }
      } else {
        items += 1;
      }
      endFrame = Math.max(endFrame, itemEnd(item));
    }
  }
  if (items > VIDEO_PROJECT_LIMITS.maxItems) return fail('too_many_items');
  if (captions > VIDEO_PROJECT_LIMITS.maxCaptionItems) {
    return fail('too_many_captions');
  }
  if (endFrame > VIDEO_PROJECT_LIMITS.maxDurationFrames) {
    return fail('too_long');
  }
  return { ok: true };
}
