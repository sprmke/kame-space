/**
 * test: N/A: decodes real media with WebCodecs through Mediabunny, which needs a browser. The
 * maths it relies on (`mixInto`, `resampleLinear`, `encodeWavMono16`, which clips count) is unit
 * tested in `captionAudio.test.ts`, and the whole flow runs in the Playwright phone spec with a
 * real WAV file.
 *
 * Builds one mono 16 kHz recording of the video's speech, laid out in project time, so the words
 * that come back need no conversion. Only the part of each clip that plays is decoded.
 */

import {
  CAPTION_SAMPLE_RATE,
  captionSourcesOf,
  downmixToMono,
  encodeWavMono16,
  mixInto,
  resampleLinear,
  type CaptionSourceMode,
} from '@/features/dashboard/marketing/lib/video/v2/captions/captionAudio';
import {
  isAudioItem,
  VIDEO_V2_LIMITS,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

export type CaptionPrepareCode = 'no_sources' | 'silent' | 'unreadable' | 'cancelled';

export class CaptionPrepareError extends Error {
  readonly code: CaptionPrepareCode;
  constructor(code: CaptionPrepareCode, message: string) {
    super(message);
    this.name = 'CaptionPrepareError';
    this.code = code;
  }
}

/** Below this the mix is silence and a call to the speech service would be wasted. */
const SILENCE_PEAK = 0.002;

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new CaptionPrepareError('cancelled', 'Cancelled');
}

export async function renderCaptionAudio(
  project: VideoProjectV2,
  mode: CaptionSourceMode,
  options: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {}
): Promise<{ blob: Blob; durationMs: number }> {
  const sources = captionSourcesOf(project, mode);
  if (sources.length === 0) {
    throw new CaptionPrepareError('no_sources', 'Nothing here has a voice to listen to.');
  }
  const { fps } = project;
  const endFrame = Math.min(
    VIDEO_V2_LIMITS.maxDurationFrames,
    Math.max(...sources.map(({ item }) => item.from + item.durationInFrames))
  );
  const total = Math.ceil((endFrame / fps) * CAPTION_SAMPLE_RATE);
  const mix = new Float32Array(total);
  const mb = await import('mediabunny');

  let done = 0;
  for (const { item } of sources) {
    throwIfAborted(options.signal);
    const rate = isAudioItem(item) ? 1 : (item.playbackRate ?? 1);
    const startSec = (item.trimBeforeFrames ?? 0) / fps;
    const endSec = startSec + (item.durationInFrames / fps) * rate;
    const gain = Math.max(0, Math.min(1, item.volume ?? 1));

    const input = new mb.Input({
      source: new mb.UrlSource(item.media.url),
      formats: mb.ALL_FORMATS,
    });
    try {
      const track = await input.getPrimaryAudioTrack();
      // A video with no sound is fine: it simply adds nothing.
      if (!track || !(await track.canDecode().catch(() => false))) continue;
      const sink = new mb.AudioBufferSink(track);
      for await (const wrapped of sink.buffers(startSec, endSec)) {
        throwIfAborted(options.signal);
        const { buffer, timestamp } = wrapped;
        const channels: Float32Array[] = [];
        for (let c = 0; c < buffer.numberOfChannels; c += 1)
          channels.push(buffer.getChannelData(c));
        const mono = downmixToMono(channels);

        // Keep only the part of this buffer that falls inside [startSec, endSec).
        const lead = Math.max(0, Math.round((startSec - timestamp) * buffer.sampleRate));
        const keepUntil = Math.min(
          mono.length,
          Math.round((endSec - timestamp) * buffer.sampleRate)
        );
        if (keepUntil <= lead) continue;
        const piece = resampleLinear(
          mono.subarray(lead, keepUntil),
          buffer.sampleRate,
          CAPTION_SAMPLE_RATE,
          rate
        );
        const sourceTime = Math.max(timestamp, startSec) - startSec;
        const at = (item.from / fps + sourceTime / rate) * CAPTION_SAMPLE_RATE;
        mixInto(mix, piece, at, gain);
      }
    } catch (error) {
      if (error instanceof CaptionPrepareError) throw error;
      throw new CaptionPrepareError('unreadable', 'That sound could not be read.');
    } finally {
      input.dispose();
    }
    done += 1;
    options.onProgress?.(done / sources.length);
  }

  let peak = 0;
  for (let i = 0; i < mix.length; i += 1) peak = Math.max(peak, Math.abs(mix[i]!));
  if (peak < SILENCE_PEAK) {
    throw new CaptionPrepareError('silent', 'We could not hear anything to caption.');
  }
  // Quiet recordings help nobody: bring the loudest moment up, but never turn noise into speech.
  const lift = peak < 0.5 ? Math.min(10, 0.8 / peak) : 1;
  if (lift !== 1) for (let i = 0; i < mix.length; i += 1) mix[i] = mix[i]! * lift;

  const wav = encodeWavMono16(mix, CAPTION_SAMPLE_RATE);
  return {
    blob: new Blob([wav as BlobPart], { type: 'audio/wav' }),
    durationMs: Math.round((endFrame / fps) * 1000),
  };
}
