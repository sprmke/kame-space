import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import {
  POSTER_ARCHETYPE_FAMILY,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

/**
 * Batch QA repair. A variant whose compiled layout fails the audit is repaired in at
 * most two steps (lighter content, then the Clean layout). A variant that still fails
 * is dropped and backfilled, so the host always receives a full set of finished posts.
 * Pure: the caller supplies the audit, so this runs in unit tests without a renderer.
 */

/** Text on paper with a framed photo: holds up on any photo and needs no scrim. */
export const CLEAN_ARCHETYPE = 'framed-editorial' as const;
const MAX_REPAIR_ATTEMPTS = 2;

/** Same layout with the busiest optional content removed. */
export function lightenSpec(spec: PosterSpec): PosterSpec {
  return {
    ...spec,
    features: spec.features.slice(0, 3),
    copy: { ...spec.copy, chips: spec.copy.chips.slice(0, 2) },
    include: { ...spec.include, infoBar: false, location: false },
  };
}

export function cleanSpec(spec: PosterSpec): PosterSpec {
  return {
    ...lightenSpec(spec),
    archetype: CLEAN_ARCHETYPE,
    fontPairing: POSTER_ARCHETYPE_DEFAULT_FONTS[CLEAN_ARCHETYPE],
  };
}

export type RepairResult = {
  specs: PosterSpec[];
  /** How many variants needed any repair, for telemetry. */
  repaired: number;
  /** Variants that could not be fixed and were replaced by a backfill. */
  dropped: number;
};

/**
 * `audit` returns the number of layout issues for a spec (0 = clean). Never throws on a
 * failing audit: if even the Clean layout fails, the spec is kept as the last resort
 * because an imperfect post beats an empty slot.
 */
export async function repairBatch(
  specs: PosterSpec[],
  audit: (spec: PosterSpec) => Promise<number>,
  options: { count?: number } = {}
): Promise<RepairResult> {
  const target = options.count ?? specs.length;
  const out: PosterSpec[] = [];
  let repaired = 0;
  let dropped = 0;

  for (const spec of specs) {
    if ((await audit(spec)) === 0) {
      out.push(spec);
      continue;
    }
    repaired += 1;
    const attempts = [lightenSpec(spec), cleanSpec(spec)].slice(0, MAX_REPAIR_ATTEMPTS);
    let fixed: PosterSpec | null = null;
    for (const attempt of attempts) {
      if ((await audit(attempt)) === 0) {
        fixed = attempt;
        break;
      }
    }
    if (fixed) out.push(fixed);
    else dropped += 1;
  }

  // Backfill: Clean layouts built from the specs we have, rotating hero photos.
  const source = specs.length > 0 ? specs : [];
  for (let i = 0; out.length < target && source.length > 0; i += 1) {
    const base = source[i % source.length]!;
    const candidate = cleanSpec({
      ...base,
      photoIndexes:
        base.photoIndexes.length > 1
          ? [...base.photoIndexes.slice(i % base.photoIndexes.length), ...base.photoIndexes]
          : base.photoIndexes,
    });
    const clean = (await audit(candidate)) === 0;
    // Keep an imperfect Clean backfill only when nothing else is possible.
    if (clean || i >= source.length) out.push(candidate);
    if (i > source.length * 2) break;
  }
  return { specs: out.slice(0, Math.max(target, 0)), repaired, dropped };
}

/**
 * Guarantees the batch contains a Clean layout and at least two layout families, by
 * swapping the weakest (last) variant. Order is otherwise preserved.
 */
export function ensureBatchDiversity(specs: PosterSpec[]): PosterSpec[] {
  if (specs.length < 2) return specs;
  const out = [...specs];
  if (!out.some((spec) => POSTER_ARCHETYPE_FAMILY[spec.archetype] === 'clean')) {
    out[out.length - 1] = cleanSpec(out[out.length - 1]!);
  }
  return out;
}
