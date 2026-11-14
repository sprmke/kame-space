/**
 * Poster contact sheet. Opens the dev-only /dev/poster-sheet route of a running
 * `./dev.sh --ui-only` server, waits for every render, and writes one PNG per cell
 * plus an index.html to tmp/poster-sheets/<run>/ (gitignored).
 *
 *   bun run marketing:contact-sheet [--base http://localhost:5173] [--format instagram-story] [--fixture cozy-condo] [--layouts split-panel,quote-card] [--samples] [--presets] [--videos]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const base = arg('base', 'http://localhost:5173');
const format = arg('format', '');
const fixture = arg('fixture', '');
const layouts = arg('layouts', '');
const samples = process.argv.includes('--samples');
const presets = process.argv.includes('--presets');
const videos = process.argv.includes('--videos');
const run = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(process.cwd(), 'tmp', 'poster-sheets', run);
mkdirSync(outDir, { recursive: true });

const query = new URLSearchParams();
if (format) query.set('format', format);
if (fixture) query.set('fixture', fixture);
if (layouts) query.set('layouts', layouts);
if (samples) query.set('samples', '1');
if (presets) query.set('presets', '1');
if (videos) query.set('videos', '1');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(`${base}/dev/poster-sheet?${query}`);
await page.waitForSelector('[data-testid="poster-sheet"][data-done="true"]', {
  timeout: 20 * 60_000,
});

const cells = await page.$$eval('[data-cell]', (nodes) =>
  nodes.map((node) => ({
    key: node.getAttribute('data-cell')!,
    status: node.getAttribute('data-status')!,
    src: node.querySelector('img')?.getAttribute('src') ?? null,
    error: node.querySelector('div')?.textContent ?? null,
  }))
);

const rows: string[] = [];
let failed = 0;
for (const cell of cells) {
  if (cell.status !== 'ok' || !cell.src) {
    failed += 1;
    rows.push(`<figure><pre>${cell.key}\n${cell.error ?? 'failed'}</pre></figure>`);
    continue;
  }
  const file = `${cell.key}.jpg`;
  const bytes = Buffer.from(cell.src.split(',')[1]!, 'base64');
  writeFileSync(join(outDir, file), bytes);
  if (samples && cell.key.startsWith('sample__')) {
    const dir = join(process.cwd(), 'ui', 'public', 'marketing', 'ai-studio', 'samples', 'posts');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${cell.key.slice('sample__'.length)}.jpg`), bytes);
  }
  rows.push(`<figure><img src="${file}" width="320"><figcaption>${cell.key}</figcaption></figure>`);
}
writeFileSync(
  join(outDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><style>body{font:12px sans-serif;display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}</style>${rows.join('')}`
);
await browser.close();

console.log(`${cells.length} cells, ${failed} failed -> ${outDir}/index.html`);
process.exit(failed > 0 ? 1 : 0);
