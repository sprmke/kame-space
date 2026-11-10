#!/usr/bin/env bun
/**
 * Re-encode public static images to modern formats at their real display sizes.
 *
 * Sources stay in the repo; the script writes `.avif` and `.webp` siblings next to them so a
 * `<picture>` can pick the smallest format the browser supports. Never overwrites a source.
 *
 * Usage:
 *   bun run images:optimize            # write the derived files
 *   bun run images:optimize -- --check # report only, exit 1 when a target is stale/missing
 *   bun run images:optimize -- --force # re-encode every target, ignoring mtimes
 */

import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const uiPublic = join(root, 'ui/public');
const checkOnly = process.argv.includes('--check');
const force = process.argv.includes('--force');

type Format = 'avif' | 'webp' | 'jpeg';

type Target = {
  /** Source file relative to `ui/public`. */
  src: string;
  /** Long edge in px. Omit to keep the source size. */
  width?: number;
  formats: Format[];
  /** Quality per format (0-100). AVIF usually takes a lower number. */
  quality?: { avif?: number; webp?: number; jpeg?: number };
  /**
   * Overwrite the source file when a derived format has the same extension
   * (`hero.jpg` + `jpeg`). Only for art whose repo copy is the published asset.
   */
  inPlace?: boolean;
};

/** Public art that ships on an indexable page. Keep this list short and explicit. */
export const OPTIMIZE_TARGETS: readonly Target[] = [
  {
    src: 'marketing/home/hero-day.jpg',
    width: 1400,
    formats: ['avif', 'webp', 'jpeg'],
    quality: { avif: 40, webp: 55, jpeg: 60 },
    inPlace: true,
  },
  {
    src: 'marketing/home/hero-night.jpg',
    width: 1400,
    formats: ['avif', 'webp', 'jpeg'],
    quality: { avif: 40, webp: 55, jpeg: 60 },
    inPlace: true,
  },
  {
    src: 'avatars/receptionist-turtle-idle.webp',
    formats: ['avif'],
    quality: { avif: 55 },
  },
];

const EXT_FOR_FORMAT: Record<Format, string> = { avif: '.avif', webp: '.webp', jpeg: '.jpg' };
const MIME_FOR_FORMAT: Record<Format, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
};

async function main() {
  let stale = 0;

  for (const target of OPTIMIZE_TARGETS) {
    const sourcePath = join(uiPublic, target.src);
    if (!existsSync(sourcePath)) {
      console.warn(`skip (missing): ${target.src}`);
      continue;
    }
    const base = sourcePath.replace(/\.[^.]+$/, '');
    const stat = statSync(sourcePath);

    for (const format of target.formats) {
      const outPath =
        target.inPlace && sourcePath.endsWith(EXT_FOR_FORMAT[format])
          ? sourcePath
          : `${base}${EXT_FOR_FORMAT[format]}`;
      const exists = existsSync(outPath);
      const outputStat = exists ? statSync(outPath) : null;
      const isStale = force || !outputStat || outputStat.mtimeMs < stat.mtimeMs;

      if (checkOnly) {
        if (isStale) {
          console.error(`stale: ${outPath.replace(`${root}/`, '')} — run bun run images:optimize`);
          stale += 1;
        }
        continue;
      }

      if (!isStale) {
        console.log(`fresh: ${outPath.replace(`${root}/`, '')}`);
        continue;
      }

      let pipeline = sharp(sourcePath);
      if (target.width) {
        pipeline = pipeline.resize({ width: target.width, withoutEnlargement: true });
      }
      // `sharp` writes pixels only, so EXIF and GPS are dropped by default.
      const quality =
        format === 'avif'
          ? (target.quality?.avif ?? 50)
          : format === 'webp'
            ? (target.quality?.webp ?? 78)
            : (target.quality?.jpeg ?? 78);
      const buffer =
        format === 'avif'
          ? await pipeline.avif({ quality, effort: 6 }).toBuffer()
          : format === 'webp'
            ? await pipeline.webp({ quality, effort: 5 }).toBuffer()
            : await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();

      writeFileSync(outPath, buffer);
      const before = Math.round(stat.size / 1024);
      const after = Math.round(buffer.byteLength / 1024);
      console.log(
        `wrote: ${outPath.replace(`${root}/`, '')} (${before} KB → ${after} KB, ${Math.round((after / before) * 100)}%, ${MIME_FOR_FORMAT[format]})`
      );
    }
  }

  if (checkOnly && stale > 0) process.exit(1);
  if (checkOnly) console.log('images:optimize OK — every derived format is up to date.');
}

await main();
