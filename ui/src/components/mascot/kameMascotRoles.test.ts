import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { KAME_MASCOT_POSES, KAME_MASCOT_WIDTHS } from '@/components/mascot/kameMascotPoses';
import {
  KAME_MASCOT_ROLES,
  KAME_SEASONAL_POSES,
  isPoseAllowedForRole,
  mascotFallbackWidth,
  mascotRoleSize,
  mascotSrcSet,
  type KameMascotRole,
} from '@/components/mascot/kameMascotRoles';

const publicDir = fileURLToPath(new URL('../../../public/assets/mascot/', import.meta.url));

describe('kame mascot poses', () => {
  it('matches the manifest exactly', () => {
    const manifest = JSON.parse(readFileSync(`${publicDir}manifest.json`, 'utf8')) as {
      poses: { file: string }[];
    };
    const fromManifest = manifest.poses.map((p) => p.file.replace(/\.png$/, '')).sort();
    expect([...KAME_MASCOT_POSES].sort()).toEqual(fromManifest);
  });

  it('has a pre-rendered variant for every pose and width', () => {
    const missing = KAME_MASCOT_POSES.flatMap((pose) =>
      KAME_MASCOT_WIDTHS.filter((w) => !existsSync(`${publicDir}v/${pose}-${w}.webp`)).map(
        (w) => `${pose}-${w}`
      )
    );
    expect(missing).toEqual([]);
  });
});

describe('kame mascot roles', () => {
  const roles = Object.keys(KAME_MASCOT_ROLES) as KameMascotRole[];

  it('only references poses that exist', () => {
    const known = new Set<string>(KAME_MASCOT_POSES);
    for (const role of roles) {
      for (const pose of KAME_MASCOT_ROLES[role].poses) {
        expect(known.has(pose), `${role}: ${pose}`).toBe(true);
      }
    }
  });

  it('keeps sizes inside the budget in kame-mascot.mdc', () => {
    expect(mascotRoleSize('welcome')).toBeGreaterThanOrEqual(96);
    expect(mascotRoleSize('welcome')).toBeLessThanOrEqual(128);
    expect(mascotRoleSize('milestone')).toBeGreaterThanOrEqual(96);
    expect(mascotRoleSize('milestone')).toBeLessThanOrEqual(128);
    expect(mascotRoleSize('daily')).toBeGreaterThanOrEqual(48);
    expect(mascotRoleSize('daily')).toBeLessThanOrEqual(64);
    expect(mascotRoleSize('setup')).toBeGreaterThanOrEqual(48);
    expect(mascotRoleSize('setup')).toBeLessThanOrEqual(64);
    expect(mascotRoleSize('ai')).toBeGreaterThanOrEqual(24);
    expect(mascotRoleSize('ai')).toBeLessThanOrEqual(32);
    expect(mascotRoleSize('empty')).toBeGreaterThanOrEqual(72);
    expect(mascotRoleSize('empty')).toBeLessThanOrEqual(96);
  });

  it('allows seasonal poses only in the welcome role', () => {
    for (const pose of KAME_SEASONAL_POSES) {
      expect(isPoseAllowedForRole('welcome', pose)).toBe(true);
      for (const role of roles.filter((r) => r !== 'welcome')) {
        expect(isPoseAllowedForRole(role, pose), `${role}: ${pose}`).toBe(false);
      }
    }
  });

  it('allows template poses as empty states only', () => {
    expect(isPoseAllowedForRole('empty', 'template-house-rules')).toBe(true);
    expect(isPoseAllowedForRole('ai', 'template-house-rules')).toBe(false);
    expect(isPoseAllowedForRole('milestone', 'template-house-rules')).toBe(false);
  });

  it('never gives the AI avatar a celebratory or serious pose', () => {
    expect(isPoseAllowedForRole('ai', 'booking-confirmed')).toBe(false);
    expect(isPoseAllowedForRole('ai', 'something-went-wrong')).toBe(false);
  });
});

describe('kame mascot srcset', () => {
  it('lists every width with a w descriptor', () => {
    expect(mascotSrcSet('hello')).toBe(
      '/assets/mascot/v/hello-96.webp 96w, /assets/mascot/v/hello-160.webp 160w, /assets/mascot/v/hello-320.webp 320w'
    );
  });

  it('picks the smallest variant covering 2x, capped at the largest', () => {
    expect(mascotFallbackWidth(28)).toBe(96);
    expect(mascotFallbackWidth(56)).toBe(160);
    expect(mascotFallbackWidth(112)).toBe(320);
    expect(mascotFallbackWidth(400)).toBe(320);
  });
});
