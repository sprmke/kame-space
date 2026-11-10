#!/usr/bin/env node
/**
 * Pre-render the marketing hero at phone and tablet widths.
 *
 * The hero is the LCP element on `/`. The source render is 1672px wide and the WebP is
 * ~246 KB, and before this existed every device downloaded that full file, including a
 * 412px phone. The variants below let the browser pick by viewport (27 KB at 480w).
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
    const out = path.join(dir, `${name}-${width}.webp`);
    await sharp(input)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(out);
    console.log(`  ${path.basename(out)}  ${Math.round(statSync(out).size / 1024)} KiB`);
    changed += 1;
  }
}
console.log(`generate-hero-variants: wrote ${changed} files`);
