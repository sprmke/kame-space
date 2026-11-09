# KameSpace brand assets

The approved F5 mark is a teal rounded container with four staggered white and mint shell pieces. It replaces the platform's letter K. Organization logos stay independently configurable.

## Sources and exports

Vector masters live in `ui/public/brand/`:

- `kame-space-mark.svg`: transparent rounded container, used by app chrome and loading screens.
- `kame-space-tile.svg`: opaque full-bleed square for operating-system masking.
- `kame-space-mark-mono.svg`: transparent white shell for notification badges and monochrome launchers.
- `kame-space-lockup-light.svg` and `kame-space-lockup-dark.svg`: outlined KameSpace wordmarks with the container. No external fonts required. Letterforms originate from the repository's Plus Jakarta Sans Bold font.

`node scripts/pwa/generate-icons.mjs` regenerates PNG icon exports (120, 512, 1024, 2048), 2400px transparent wordmarks, SVG/PNG/ICO favicons (16/32/48/96), Apple touch icons, any/maskable/monochrome PWA icons, pinned-tab silhouette, notification badge, light/dark iOS launch screens, and the 1200×630 `kame-space-social-f5.png` share card. Root `favicon.ico` and `apple-touch-icon.png` support implicit browser requests. Keep vector masters and generated files in the same commit. The contained shell fits within the maskable 80%-diameter safe circle.

Colors: container `#2DAA97`, white `#FFFFFF`, mint `#BDEFE1`; light wordmark `#090B10` / `#08665A`; dark wordmark `#FFFFFF` / `#8EE5D0`. The icon itself stays the same across light/dark themes; monochrome is for system tinting, not the normal app header.

## Delivery and sharing

`MarketingBrandLogo`, `KameSpaceBrandIcon`, and `appLoaderHost` use the same SVG. The shell precache includes that file for offline launch. Manifest icon URLs have an F5 version query; the app's manifest `id`, start URL and shortcuts stay unchanged. Stable brand/icon URLs revalidate through Vercel. Existing email and organization fallbacks at `/images/logo.png` contain F5.

Working outside the app bundle:

- `marketing/social` renders the same four paths through `KameSpaceMark` in `src/primitives.tsx` (wordmarks and mock phone app icons). Re-render the stills and videos after a mark change: `bun run render:all`.
- `docs/brand/logo-drafts/` keeps rejected explorations. It lives outside `ui/public/` so drafts never ship with the build.
- `docs/screenshots/` holds the README portfolio images. Regenerate with `bun scripts/dev/capture-readme-screenshots.mjs`, `capture-readme-extra.mjs` and `capture-readme-tour-chapters.mjs`; they capture production, so run them after the mark is live.

`ui/index.html` contains Open Graph and Twitter large-image metadata without requiring JavaScript. Its default image uses the canonical production asset URL. Listing crawler middleware keeps listing titles and photos; listings without photos use the brand card on their own origin. `usePageMeta` uses the same fallback for client navigation and removes default card dimensions when a listing photo is selected.

The brand pack is deployed with the web build. This does not update logos manually uploaded to Google OAuth, social profiles or other provider consoles: use `kame-space-mark-120.png` or the larger icon export there. Search engines and messaging platforms may retain old previews until recrawled; use their rescrape tools after deployment where available. Installed apps may retain the old launcher icon until the OS refreshes the manifest; on iOS, removing and adding the home-screen shortcut may be needed. Do not clear user data or change the manifest identity to force an icon refresh.

## Verification and scope

Check SVG/ICO/PNG responses, favicon tags and manifest assets in the built output, shell precache inclusion, icon transparency, maskable safe area, light/dark headers at 375/768/1024px, and default versus listing-photo crawler metadata. The SEO regression tests cover replacement of default image tags without duplicates or stale dimensions.

Activity-log: N/A (static branding and read-only metadata). Plans/RBAC: N/A. No booking, authentication or tenant-brand settings behavior changes.

References: [MDN app icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons), [Google favicon requirements](https://developers.google.com/search/docs/appearance/favicon-in-search), [Open Graph](https://ogp.me/).
