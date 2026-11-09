/**
 * Share it yourself — capability detection and the copy/download fallbacks.
 *
 * Pure planning logic so the fallbacks are unit-tested; the sheet does the actual
 * `navigator.share` / clipboard / download calls.
 */

export type ShareCapabilities = {
  hasShare: boolean;
  canShareFiles: boolean;
  hasClipboard: boolean;
};

export type SharePlan = 'share-files' | 'share-text' | 'copy-only';

export function resolveSharePlan(caps: ShareCapabilities): SharePlan {
  if (caps.hasShare && caps.canShareFiles) return 'share-files';
  if (caps.hasShare) return 'share-text';
  return 'copy-only';
}

export function readBrowserShareCapabilities(): ShareCapabilities {
  if (typeof navigator === 'undefined') {
    return { hasShare: false, canShareFiles: false, hasClipboard: false };
  }
  const hasShare = typeof navigator.share === 'function';
  const canShareFiles =
    typeof navigator.canShare === 'function' &&
    (() => {
      try {
        return navigator.canShare({
          files: [new File([new Blob(['x'])], 'preview.png', { type: 'image/png' })],
        });
      } catch {
        return false;
      }
    })();
  return {
    hasShare,
    canShareFiles,
    hasClipboard: typeof navigator.clipboard?.writeText === 'function',
  };
}

/** File name a host would recognise when the download fallback runs. */
export function shareFileName(input: { title: string; extension: 'png' | 'jpg' | 'mp4' }): string {
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'marketing-post'}.${input.extension}`;
}

/** Reminder copy for the moment a manual item is due. */
export function shareReminderText(input: { title: string; channelLabel: string }): string {
  return `Time to post: ${input.title} (${input.channelLabel})`;
}

export function extensionForMedia(mimeType: string | null | undefined): 'png' | 'jpg' | 'mp4' {
  if (mimeType === 'video/mp4' || mimeType?.startsWith('video/')) return 'mp4';
  return 'png';
}
