#!/usr/bin/env node
/**
 * Pre-render the marketing hero at phone and tablet widths.
 *
 * The hero is the LCP element on `/`. Before this existed every device downloaded the full
 * render, including a 412px phone. The variants below let the browser pick by viewport
 * (27 KB at 480w). Each width is written twice: AVIF first (roughly half the WebP at the
 * same width), then WebP for browsers without AVIF. The JPEG stays as the last fallback.
 *
 * Run after replacing `hero-day.jpg` / `hero-night.jpg`:
 *   node scripts/media/generate-hero-variants.mjs
 *
 * Output is committed, so the build does not depend on sharp being present.
 */
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, 'ui/public/marketing/home');
const WIDTHS = [480, 800, 1200];
const NAMES = ['hero-day', 'hero-night'];

let changed = 0;
for (const name of NAMES) {
  const input = path.join(dir, `${name}.jpg`);
  if (!existsSync(input)) {
    console.error(`generate-hero-variants: missing ${input}`);
    process.exitCode = 1;
    continue;
  }
  for (const width of WIDTHS) {
    const resized = sharp(input).resize({ width, withoutEnlargement: true });

    const avif = path.join(dir, `${name}-${width}.avif`);
    await resized.clone().avif({ quality: 50, effort: 6 }).toFile(avif);
    console.log(`  ${path.basename(avif)}  ${Math.round(statSync(avif).size / 1024)} KiB`);

    const webp = path.join(dir, `${name}-${width}.webp`);
    await resized.clone().webp({ quality: 72 }).toFile(webp);
    console.log(`  ${path.basename(webp)}  ${Math.round(statSync(webp).size / 1024)} KiB`);

    changed += 2;
  }
}
console.log(`generate-hero-variants: wrote ${changed} files`);
