#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const dist = resolve(root, 'ui/dist');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');

const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/);
if (!entryMatch?.[1]) {
  throw new Error('Could not find the module entry script in ui/dist/index.html');
}

const assetPaths = new Set([entryMatch[1]]);
for (const match of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) {
  assetPaths.add(match[1]);
}

function gzipBytes(publicPath) {
  const relativePath = publicPath.replace(/^\/+/, '');
  return gzipSync(readFileSync(resolve(dist, relativePath))).byteLength;
}

const entryGzipBytes = gzipBytes(entryMatch[1]);
const initialGzipBytes = [...assetPaths].reduce((total, path) => total + gzipBytes(path), 0);

// Ratcheted to the measured build on 2026-11-09 (entry 246.4 KiB, initial 633.2 KiB) with
// about 5% headroom. The previous 500 / 1200 KiB ceilings passed at roughly 2x the real size,
// which meant the gate could not detect a regression at all. When a change legitimately needs
// more, raise these deliberately in the same PR and say why.
const entryBudgetBytes = 260 * 1024;
const initialBudgetBytes = 660 * 1024;
const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

console.log(
  `Initial bundle: entry ${formatKiB(entryGzipBytes)}, ` +
    `${assetPaths.size} initial chunks ${formatKiB(initialGzipBytes)} gzip`
);

const failures = [];
if (entryGzipBytes > entryBudgetBytes) {
  failures.push(`entry exceeds ${formatKiB(entryBudgetBytes)}`);
}
if (initialGzipBytes > initialBudgetBytes) {
  failures.push(`initial chunks exceed ${formatKiB(initialBudgetBytes)}`);
}

if (failures.length) {
  throw new Error(`Bundle budget failed: ${failures.join('; ')}`);
}
