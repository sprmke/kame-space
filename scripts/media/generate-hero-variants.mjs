#!/usr/bin/env node
/**
 * Pre-render the marketing hero at phone, tablet, and desktop widths.
 *
 * The hero is the LCP element on `/`. Width variants let the browser pick by viewport
 * (a phone takes ~640w; a retina laptop can take the full master). Each width is written
 * twice: AVIF first, then WebP. The JPEG master stays as the last fallback.
 *
 * Quality targets favour sharpness over the earlier SEO crush (AVIF q40 / WebP q55 at
 * 1400px). Phones still get a small file; desktop gets a clear image.
 *
 * Run after replacing `hero-day.jpg` / `hero-night.jpg` (source long edge should match
 * `HERO_IMAGE_WIDTH` in `themeHeroTransition.ts`, currently 1672):
 *   node scripts/media/generate-hero-variants.mjs
 *
 * Output is committed, so the build does not depend on sharp being present.
 */
import { existsSync, unlinkSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, 'ui/public/marketing/home');
/** Ladder covers 1x phones through the full master. Do not invent pixels past the JPEG. */
const WIDTHS = [640, 960, 1280, 1672];
/** Retired widths from the 1400px SEO pass. Delete so stale files cannot be served. */
const LEGACY_WIDTHS = [480, 800, 1200, 1400];
const NAMES = ['hero-day', 'hero-night'];
const AVIF_QUALITY = 62;
const WEBP_QUALITY = 80;

let changed = 0;
for (const name of NAMES) {
  const input = path.join(dir, `${name}.jpg`);
  if (!existsSync(input)) {
    console.error(`generate-hero-variants: missing ${input}`);
    process.exitCode = 1;
    continue;
  }

  const meta = await sharp(input).metadata();
  const masterWidth = meta.width ?? 0;
  if (masterWidth < Math.max(...WIDTHS)) {
    console.warn(
      `generate-hero-variants: ${name}.jpg is ${masterWidth || '?'}px wide; expected ≥ ${Math.max(...WIDTHS)}`
    );
  }

  // Full-size WebP sibling for budget checks and non-srcset fallbacks. JPEG master is left
  // alone so we never re-crush the committed source.
  const fullWebp = path.join(dir, `${name}.webp`);
  const webpBuf = await sharp(input).rotate().webp({ quality: WEBP_QUALITY, effort: 5 }).toBuffer();
  writeFileSync(fullWebp, webpBuf);
  console.log(`  ${path.basename(fullWebp)}  ${Math.round(webpBuf.byteLength / 1024)} KiB`);
  changed += 1;

  for (const width of WIDTHS) {
    const resized = sharp(input).rotate().resize({ width, withoutEnlargement: true });

    const avif = path.join(dir, `${name}-${width}.avif`);
    const avifBuf = await resized.clone().avif({ quality: AVIF_QUALITY, effort: 6 }).toBuffer();
    writeFileSync(avif, avifBuf);
    console.log(`  ${path.basename(avif)}  ${Math.round(avifBuf.byteLength / 1024)} KiB`);

    const webp = path.join(dir, `${name}-${width}.webp`);
    const variantWebp = await resized.clone().webp({ quality: WEBP_QUALITY, effort: 5 }).toBuffer();
    writeFileSync(webp, variantWebp);
    console.log(`  ${path.basename(webp)}  ${Math.round(variantWebp.byteLength / 1024)} KiB`);

    changed += 2;
  }

  for (const width of LEGACY_WIDTHS) {
    for (const ext of ['avif', 'webp']) {
      const stale = path.join(dir, `${name}-${width}.${ext}`);
      if (existsSync(stale)) {
        unlinkSync(stale);
        console.log(`  removed ${path.basename(stale)}`);
      }
    }
  }

  // Drop the full-size AVIF sibling from the SEO pass if present (srcset covers AVIF now).
  const fullAvif = path.join(dir, `${name}.avif`);
  if (existsSync(fullAvif)) {
    unlinkSync(fullAvif);
    console.log(`  removed ${path.basename(fullAvif)}`);
  }
}
console.log(`generate-hero-variants: wrote ${changed} files`);
