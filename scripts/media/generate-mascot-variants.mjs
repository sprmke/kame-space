#!/usr/bin/env node
/**
 * Pre-render the Kame mascot poses at phone-friendly widths.
 *
 * The masters (`ui/public/assets/mascot/<pose>.png`, 448 x 468, 140 to 200 KB each) are too
 * heavy for a list or an app bar. `KameMascot` serves these WebP variants through `srcset`:
 *
 *   ui/public/assets/mascot/v/<pose>-96.webp | -160.webp | -320.webp
 *
 * Run after adding or replacing a pose:
 *   node scripts/media/generate-mascot-variants.mjs
 *
 * Output is committed, so the build does not depend on sharp being present. Then update
 * `ui/src/components/mascot/kameMascotPoses.ts` (a unit test fails if it drifts from the manifest).
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, 'ui/public/assets/mascot');
const outDir = path.join(dir, 'v');
const WIDTHS = [96, 160, 320];
const WEBP_QUALITY = 84;

const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
mkdirSync(outDir, { recursive: true });

let files = 0;
let bytes = 0;
for (const pose of manifest.poses) {
  const slug = pose.file.replace(/\.png$/, '');
  const input = path.join(dir, pose.file);
  for (const width of WIDTHS) {
    const output = path.join(outDir, `${slug}-${width}.webp`);
    await sharp(input)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 5, alphaQuality: 90 })
      .toFile(output);
    files += 1;
    bytes += statSync(output).size;
  }
}
console.log(
  `generate-mascot-variants: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB in ${path.relative(root, outDir)}`
);
