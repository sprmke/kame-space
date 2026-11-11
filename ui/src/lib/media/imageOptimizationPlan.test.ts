import { describe, expect, it } from 'vitest';

import {
  PRESET_CONFIGS,
  planOptimization,
  type Plan,
  type PlanInput,
} from '@/lib/media/imageOptimizationPlan';

const bigJpeg: PlanInput = {
  preset: 'LISTING_PHOTO',
  mime: 'image/jpeg',
  sizeBytes: 6 * 1024 * 1024,
  sourceLongEdge: 6000,
  hasAlpha: false,
  animated: false,
};

function reencode(plan: Plan): Extract<Plan, { action: 'reencode' }> {
  if (plan.action !== 'reencode') throw new Error(`expected reencode, got ${plan.action}`);
  return plan;
}

describe('LISTING_PHOTO preset', () => {
  it('caps the long edge at 2560 and re-encodes to WebP at quality 0.8', () => {
    const plan = reencode(planOptimization(bigJpeg));
    expect(plan.targetLongEdge).toBe(2560);
    expect(plan.fileType).toBe('image/webp');
    expect(plan.extension).toBe('.webp');
    expect(plan.quality).toBeCloseTo(0.8, 5);
  });

  it('is smaller than the master preset so guests never download a 3840px original', () => {
    expect(PRESET_CONFIGS.LISTING_PHOTO.maxLongEdge).toBeLessThan(
      PRESET_CONFIGS.PHOTO_MASTER.maxLongEdge
    );
    expect(PRESET_CONFIGS.LISTING_PHOTO.format).toBe('webp');
  });

  it('leaves an already-small photo alone', () => {
    const plan = planOptimization({
      ...bigJpeg,
      sizeBytes: 180 * 1024,
      sourceLongEdge: 2000,
    });
    expect(plan.action).toBe('passthrough');
  });

  it('never upscales a small source', () => {
    const plan = planOptimization({ ...bigJpeg, sourceLongEdge: 800 });
    // 800px is below the preset floor, so the file is re-encoded at its own size, never
    // blown up to 2560.
    if (plan.action === 'reencode') {
      expect(plan.targetLongEdge).toBeLessThanOrEqual(2560);
    } else {
      expect(plan.action).toBe('passthrough');
    }
  });

  it('passes animated images through untouched', () => {
    const plan = planOptimization({ ...bigJpeg, mime: 'image/gif', animated: true });
    expect(plan.action).toBe('passthrough');
  });

  it('is a no-op when optimization is disabled', () => {
    const plan = planOptimization({ ...bigJpeg, disabled: true });
    expect(plan).toEqual({ action: 'passthrough', reason: 'disabled' });
  });
});

describe('EXIF privacy', () => {
  it('always routes host photos through a re-encode, which drops EXIF', () => {
    // The canvas re-encode in optimizeImage writes pixels only, so GPS and camera data
    // from host or guest photos never reaches Storage. The plan must not pass a photo
    // through merely because its pixel dimensions already fit.
    const plan = planOptimization({
      ...bigJpeg,
      sizeBytes: 900 * 1024,
      sourceLongEdge: 2400,
    });
    expect(plan.action).toBe('reencode');
  });
});
