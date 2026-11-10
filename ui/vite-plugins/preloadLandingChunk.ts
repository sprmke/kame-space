import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

/**
 * Module-preload the landing page's chunk.
 *
 * Vite preloads the entry's *static* imports. A lazy route chunk is fetched only when the
 * router reaches that route, which is after the entry has parsed and executed. On the most
 * visited public URL that is a guaranteed extra round trip before the hero can paint.
 *
 * This reads the build manifest after the bundle is written and adds one `modulepreload`
 * for the landing chunk. `GuestLandingPage` is a small chunk, so the win is the round trip,
 * not the bytes.
 *
 * Failure modes are deliberately quiet: if the manifest is missing, the entry is not found,
 * or the write fails, the build keeps its previous behaviour. A missing preload is a lost
 * optimisation, never a broken deploy.
 */

/**
 * Manifest key for the page served at `/`.
 *
 * If the landing route is renamed again this stops matching and the plugin quietly does
 * nothing, so the build stays correct and the preload is simply lost. Keep it in step with
 * the `<Route index element=...>` in `src/features/guest/marketing/routes/index.tsx`.
 */
const LANDING_SOURCE = 'src/features/guest/marketing/pages/MarketingHomePage.tsx';

export function preloadLandingChunk(): Plugin {
  return {
    name: 'gfm:preload-landing-chunk',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      try {
        const outDir = path.resolve(import.meta.dirname, '../dist');
        const manifestPath = path.join(outDir, '.vite/manifest.json');
        const indexPath = path.join(outDir, 'index.html');

        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
          string,
          { file?: string }
        >;
        const chunk = manifest[LANDING_SOURCE]?.file;
        if (!chunk) return;

        const html = readFileSync(indexPath, 'utf8');
        const href = `/${chunk}`;
        if (html.includes(`href="${href}"`)) return;

        const tag = `    <link rel="modulepreload" crossorigin href="${href}">\n`;
        // Insert before the first existing modulepreload so the tag stays grouped with the
        // others rather than landing after the closing head.
        const firstPreload = html.indexOf('<link rel="modulepreload"');
        const next =
          firstPreload === -1
            ? html.replace('</head>', `${tag}</head>`)
            : html.slice(0, firstPreload) + tag + html.slice(firstPreload);

        writeFileSync(indexPath, next);
      } catch {
        // Never fail a build over an optimisation.
      }
    },
  };
}
