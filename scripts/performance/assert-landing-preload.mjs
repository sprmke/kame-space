#!/usr/bin/env node
/**
 * Asserts the landing page's chunk is module-preloaded.
 *
 * `preloadLandingChunk` fails silently by design: if the landing route is renamed, the
 * manifest key stops matching and the plugin does nothing rather than breaking the build.
 * That silence is correct at build time and wrong as a permanent state, so this turns it
 * into a CI failure instead.
 *
 * Also checks the preloaded file actually exists in `dist`, because a stale manifest entry
 * would otherwise ship a 404 preload.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'ui/dist');
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(path.join(dist, '.vite/manifest.json'), 'utf8'));

const LANDING_SOURCE = 'src/features/guest/marketing/pages/MarketingHomePage.tsx';
const landingChunk = manifest[LANDING_SOURCE]?.file;

if (!landingChunk) {
  console.error(
    `assert-landing-preload: no chunk for ${LANDING_SOURCE}.\n` +
      'If the landing route was renamed, update LANDING_SOURCE in\n' +
      'ui/vite-plugins/preloadLandingChunk.ts and this script together.'
  );
  process.exit(1);
}

const href = `/${landingChunk}`;
if (!html.includes(`rel="modulepreload"`) || !html.includes(`href="${href}"`)) {
  console.error(
    `assert-landing-preload: index.html does not modulepreload ${href}.\n` +
      'The landing chunk would be fetched only after the entry executes, adding a round trip.'
  );
  process.exit(1);
}

if (!existsSync(path.join(dist, landingChunk))) {
  console.error(`assert-landing-preload: ${landingChunk} is preloaded but not present in dist.`);
  process.exit(1);
}

console.log(`assert-landing-preload: OK — ${href} is module-preloaded and present.`);
