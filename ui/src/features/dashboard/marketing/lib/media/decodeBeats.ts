import { detectBeats, mixToMono } from '@/features/dashboard/marketing/lib/media/beats';

/** Beat times (seconds from the start of the file) of an audio URL the browser can read. */
export async function decodeBeatTimes(url: string, signal?: AbortSignal): Promise<number[]> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('audio_unreadable');
  const bytes = await response.arrayBuffer();
  const Context =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Context();
  try {
    const buffer = await context.decodeAudioData(bytes);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i)
    );
    return detectBeats(mixToMono(channels), buffer.sampleRate);
  } finally {
    void context.close();
  }
}
