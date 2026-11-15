/**
 * Builds `tmp/e2e-demo/index.html`: every recorded video from `bun run test:e2e:demo`,
 * grouped by viewport, so a reviewer can watch the changes in action.
 * Run: bun scripts/e2e/demoIndex.ts
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'tmp/e2e-demo';
const ORDER = [
  'phone-small',
  'phone',
  'phone-large',
  'tablet',
  'tablet-landscape',
  'laptop',
  'desktop',
  'wide',
];

type Clip = { viewport: string; title: string; file: string; kb: number };

const clips: Clip[] = [];
for (const dir of readdirSync(ROOT)) {
  const folder = join(ROOT, dir);
  if (!statSync(folder).isDirectory()) continue;
  // Longest match first: `phone-small` must not be read as `phone`.
  const viewport =
    [...ORDER].sort((x, y) => y.length - x.length).find((name) => dir.endsWith(`-${name}`)) ?? 'other';
  for (const file of readdirSync(folder).filter((name) => name.endsWith('.webm'))) {
    clips.push({
      viewport,
      title: dir.replace(new RegExp(`-${viewport}$`), '').replace(/-/g, ' '),
      file: `${dir}/${file}`,
      kb: Math.round(statSync(join(folder, file)).size / 1024),
    });
  }
}

const esc = (value: string) => value.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const sections = ORDER.filter((name) => clips.some((clip) => clip.viewport === name))
  .map((name) => {
    const items = clips
      .filter((clip) => clip.viewport === name)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(
        (clip) =>
          `<figure><video controls preload="none" src="${esc(clip.file)}"></video><figcaption>${esc(clip.title)} (${clip.kb} KB)</figcaption></figure>`
      )
      .join('\n');
    return `<h2>${esc(name)} <small>${clips.filter((clip) => clip.viewport === name).length} clips</small></h2><div class="grid">${items}</div>`;
  })
  .join('\n');

writeFileSync(
  join(ROOT, 'index.html'),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E2E demo videos</title>
<style>body{font:14px system-ui;margin:16px;background:#fafafa;color:#111}h2{margin:28px 0 8px}small{color:#666;font-weight:400}
.grid{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;max-width:420px}video{width:100%;background:#000;border-radius:8px}figcaption{font-size:12px;color:#444;padding:4px 0}
@media (prefers-color-scheme:dark){body{background:#111;color:#eee}figcaption{color:#aaa}}</style>
<h1>E2E demo videos</h1>${sections}`
);
console.log(`${clips.length} clips -> ${join(ROOT, 'index.html')}`);
