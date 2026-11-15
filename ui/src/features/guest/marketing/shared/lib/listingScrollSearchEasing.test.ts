import { describe, expect, it } from 'vitest';

import {
  clamp01,
  smoothstep,
  easeOutCubic,
  lerp,
  MIN_MORPH_TRAVEL,
  morphTravelDistance,
} from '@/features/guest/marketing/shared/lib/listingScrollSearchEasing';

describe('clamp01', () => {
  it('clamp01 is exported', () => {
    expect(typeof clamp01).toBe('function');
  });
});

describe('smoothstep', () => {
  it('smoothstep is exported', () => {
    expect(typeof smoothstep).toBe('function');
  });
});

describe('easeOutCubic', () => {
  it('easeOutCubic is exported', () => {
    expect(typeof easeOutCubic).toBe('function');
  });
});

describe('lerp', () => {
  it('lerp is exported', () => {
    expect(typeof lerp).toBe('function');
  });
});

describe('morphTravelDistance', () => {
  it('keeps the full distance when the page can scroll it', () => {
    expect(morphTravelDistance(400, 168)).toBe(168);
    expect(morphTravelDistance(168, 168)).toBe(168);
  });

  it('shortens to what a short page can scroll', () => {
    expect(morphTravelDistance(57, 168)).toBe(57);
  });

  it('never drops below the minimum travel', () => {
    expect(morphTravelDistance(5, 168)).toBe(MIN_MORPH_TRAVEL);
  });

  it('uses the full distance when the page cannot morph or the input is invalid', () => {
    expect(morphTravelDistance(0, 168)).toBe(168);
    expect(morphTravelDistance(-20, 168)).toBe(168);
    expect(morphTravelDistance(Number.NaN, 168)).toBe(168);
  });
});
