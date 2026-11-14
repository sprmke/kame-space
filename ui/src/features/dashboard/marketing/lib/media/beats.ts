/**
 * Beat detection for cutting a reel on the music. Pure, no DOM: feed it decoded mono samples.
 * Energy envelope, then positive energy jumps (onsets), then peak picking with a minimum gap.
 */

const HOP_SEC = 0.01;
/** Closest two beats may sit; keeps hi-hat chatter from becoming cuts. */
const MIN_GAP_SEC = 0.28;
/** An onset must beat the local average by this many standard deviations. */
const THRESHOLD_SIGMAS = 0.6;
/** Local window (seconds each side) for the adaptive threshold. */
const WINDOW_SEC = 1;

/** RMS energy per 10 ms hop. */
export function energyEnvelope(samples: ArrayLike<number>, sampleRate: number): Float32Array {
  const hop = Math.max(1, Math.round(sampleRate * HOP_SEC));
  const count = Math.floor(samples.length / hop);
  const out = new Float32Array(count);
  for (let h = 0; h < count; h += 1) {
    let sum = 0;
    const start = h * hop;
    for (let i = 0; i < hop; i += 1) {
      const v = samples[start + i]!;
      sum += v * v;
    }
    out[h] = Math.sqrt(sum / hop);
  }
  return out;
}

/** How much louder each hop is than the one before (never negative), lightly smoothed. */
export function onsetStrength(envelope: ArrayLike<number>): Float32Array {
  const flux = new Float32Array(envelope.length);
  for (let i = 1; i < envelope.length; i += 1) {
    flux[i] = Math.max(0, envelope[i]! - envelope[i - 1]!);
  }
  const smooth = new Float32Array(flux.length);
  for (let i = 0; i < flux.length; i += 1) {
    const a = flux[i - 1] ?? 0;
    const c = flux[i + 1] ?? 0;
    smooth[i] = (a + 2 * flux[i]! + c) / 4;
  }
  return smooth;
}

/** Times (seconds) of the strongest onsets, at least `MIN_GAP_SEC` apart. */
export function pickBeats(strength: ArrayLike<number>): number[] {
  const n = strength.length;
  const half = Math.round(WINDOW_SEC / HOP_SEC);
  const candidates: Array<{ index: number; value: number }> = [];
  for (let i = 1; i < n - 1; i += 1) {
    const value = strength[i]!;
    if (value <= 0 || value < strength[i - 1]! || value < strength[i + 1]!) continue;
    const from = Math.max(0, i - half);
    const to = Math.min(n, i + half);
    let mean = 0;
    for (let j = from; j < to; j += 1) mean += strength[j]!;
    mean /= to - from;
    let variance = 0;
    for (let j = from; j < to; j += 1) variance += (strength[j]! - mean) ** 2;
    const sigma = Math.sqrt(variance / (to - from));
    if (value > mean + THRESHOLD_SIGMAS * sigma) candidates.push({ index: i, value });
  }
  // Strongest first, drop anything that crowds a stronger beat.
  const minGap = Math.round(MIN_GAP_SEC / HOP_SEC);
  const kept: number[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.value - a.value)) {
    if (kept.every((index) => Math.abs(index - candidate.index) >= minGap)) {
      kept.push(candidate.index);
    }
  }
  return kept.sort((a, b) => a - b).map((index) => Math.round(index * HOP_SEC * 1000) / 1000);
}

/** Beat times in seconds from mono samples. Empty when the track has no clear pulse. */
export function detectBeats(samples: ArrayLike<number>, sampleRate: number): number[] {
  if (sampleRate <= 0 || samples.length < sampleRate) return [];
  return pickBeats(onsetStrength(energyEnvelope(samples, sampleRate)));
}

/** Average the channels of a decoded buffer into one array. */
export function mixToMono(channels: ArrayLike<number>[]): Float32Array {
  const length = channels[0]?.length ?? 0;
  const out = new Float32Array(length);
  if (channels.length === 0) return out;
  for (const channel of channels) {
    for (let i = 0; i < length; i += 1) out[i] = out[i]! + channel[i]! / channels.length;
  }
  return out;
}
