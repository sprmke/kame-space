/**
 * Client for the `marketing-video-captions` edge function: send a short recording, get timed
 * words back. Authenticated and property scoped; failures carry a plain message and, when a plan
 * or AI allowance is the reason, `upgradeHook`.
 */

import type { CaptionWord } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type CaptionLanguage = 'auto' | 'en' | 'tl';

export class CaptionApiError extends Error {
  readonly status: number;
  readonly upgradeHook: boolean;
  constructor(message: string, status: number, upgradeHook = false) {
    super(message);
    this.name = 'CaptionApiError';
    this.status = status;
    this.upgradeHook = upgradeHook;
  }
}

export async function requestCaptionWords(
  propertyId: string,
  audio: Blob,
  options: { language: CaptionLanguage; durationMs: number; signal?: AbortSignal }
): Promise<{ words: CaptionWord[]; language: string | null }> {
  const jwt = await getSessionJwt();
  const form = new FormData();
  form.append('audio', new File([audio], 'captions.wav', { type: 'audio/wav' }));
  form.append('language', options.language);
  form.append('durationMs', String(Math.round(options.durationMs)));

  const response = await fetch(scopedFunctionsUrl('/marketing-video-captions', propertyId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
    signal: options.signal,
  });

  let json: {
    success?: boolean;
    data?: { words?: CaptionWord[]; language?: string | null };
    error?: string;
    upgradeHook?: boolean;
  } = {};
  try {
    json = await response.json();
  } catch {
    // A gateway error with no body: use the status message below.
  }
  if (!response.ok || json.success === false || !json.data) {
    throw new CaptionApiError(
      json.error ?? 'Captions could not be made. Try again.',
      response.status,
      json.upgradeHook === true
    );
  }
  return { words: json.data.words ?? [], language: json.data.language ?? null };
}
