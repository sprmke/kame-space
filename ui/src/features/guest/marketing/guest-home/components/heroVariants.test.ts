import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The hero is the LCP element on `/`. Its `<source srcSet>` lists width variants by filename,
 * so a missing file is a silent 404 for exactly the users we optimised for. This pins the
 * files the component points at.
 *
 * Regenerate with `node scripts/media/generate-hero-variants.mjs`.
 */

const HERO_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../public/marketing/home'
);
const WIDTHS = [640, 960, 1280, 1672];
const NAMES = ['hero-day', 'hero-night'];

describe('marketing hero width variants', () => {
  for (const name of NAMES) {
    for (const width of WIDTHS) {
      it(`${name}-${width}.avif exists and beats the WebP at the same width`, () => {
        const avif = path.join(HERO_DIR, `${name}-${width}.avif`);
        const webp = path.join(HERO_DIR, `${name}-${width}.webp`);
        expect(existsSync(avif), `missing ${avif}`).toBe(true);
        // AVIF is offered first, so it must actually be the smaller option.
        expect(statSync(avif).size).toBeLessThan(statSync(webp).size);
      });

      it(`${name}-${width}.webp exists and is smaller than or equal to the full render`, () => {
        const variant = path.join(HERO_DIR, `${name}-${width}.webp`);
        const full = path.join(HERO_DIR, `${name}.webp`);

        expect(existsSync(variant), `missing ${variant}`).toBe(true);
        if (existsSync(full) && width < 1672) {
          expect(statSync(variant).size).toBeLessThan(statSync(full).size);
        }
      });
    }
  }

  it('the 640w variant is meaningfully smaller than the full render', () => {
    const small = statSync(path.join(HERO_DIR, 'hero-day-640.webp')).size;
    const full = statSync(path.join(HERO_DIR, 'hero-day.webp')).size;
    // A phone must not download the desktop file. Assert a floor of 3x.
    expect(full / small).toBeGreaterThan(3);
  });

  it('ships a full-width 1672w variant for large and retina screens', () => {
    for (const name of NAMES) {
      expect(existsSync(path.join(HERO_DIR, `${name}-1672.webp`))).toBe(true);
      expect(existsSync(path.join(HERO_DIR, `${name}-1672.avif`))).toBe(true);
    }
  });
});
