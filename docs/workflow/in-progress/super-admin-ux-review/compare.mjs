/**
 * Compose before/after screenshot pairs (side by side) and an index page.
 *
 * Usage: node compare.mjs
 * Reads fixes/before/*.png and fixes/after/*.png, writes fixes/compare/*.png + index.html.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanvas, loadImage } from 'canvas';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BEFORE = path.join(HERE, 'fixes/before');
const AFTER = path.join(HERE, 'fixes/after');
const OUT = path.join(HERE, 'fixes/compare');

const LABEL_H = 34;
const GAP = 16;

async function compose(beforeFile, afterFile) {
  const [before, after] = await Promise.all([loadImage(beforeFile), loadImage(afterFile)]);
  const width = before.width + after.width + GAP;
  const height = Math.max(before.height, after.height) + LABEL_H;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f4f5f7';
  ctx.fillRect(0, 0, width, height);
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillStyle = '#111827';
  ctx.fillText('Before', 10, 22);
  ctx.fillText('After', before.width + GAP + 10, 22);

  ctx.drawImage(before, 0, LABEL_H);
  ctx.drawImage(after, before.width + GAP, LABEL_H);
  return canvas;
}

const [beforeFiles, afterFiles] = await Promise.all([
  readdir(BEFORE).catch(() => []),
  readdir(AFTER).catch(() => []),
]);
const afterSet = new Set(afterFiles.filter((name) => name.endsWith('.png')));

await mkdir(OUT, { recursive: true });

const pairs = [];
for (const name of beforeFiles.filter((file) => file.endsWith('.png')).sort()) {
  if (!afterSet.has(name)) continue;
  const canvas = await compose(path.join(BEFORE, name), path.join(AFTER, name));
  await writeFile(path.join(OUT, name), canvas.toBuffer('image/png'));
  pairs.push(name.replace('.png', ''));
}

const rows = pairs
  .map(
    (name) => `<figure><figcaption>${name}</figcaption><img src="${name}.png" loading="lazy" alt="${name} before and after" /></figure>`
  )
  .join('\n');

await writeFile(
  path.join(OUT, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Super admin before/after</title>
<style>
  body{font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#eef0f3;margin:0;padding:24px}
  h1{font-size:18px;margin:0 0 16px}
  figure{background:#fff;border-radius:12px;padding:12px;margin:0 0 20px;box-shadow:0 1px 3px rgba(0,0,0,.12)}
  figcaption{font-weight:600;margin-bottom:8px}
  img{display:block;max-width:100%;height:auto}
</style>
<h1>Super admin: before and after (${pairs.length} screens)</h1>
${rows}`
);

console.log(`Wrote ${pairs.length} comparisons to ${OUT}`);
