# Third-party origins (browser)

Inventory for CSP (doc 22) and defer-non-critical scripts (doc 04). First-party rewrites count as `'self'`.

| Origin / pattern                                                    | Used for                                                                                                                              | Load path                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `'self'`                                                            | Vite bundles, PWA, `/ingest` PostHog proxy (`ui/vercel.json`)                                                                         | Same origin                          |
| `https://fonts.googleapis.com`                                      | Brand font CSS (`ui/index.html` preload)                                                                                              | `<link>`                             |
| `https://fonts.gstatic.com`                                         | Font files. Also `connect-src`: the service worker and the Polotno editor fetch them                                                  | CSS + service worker cache           |
| `https://*.supabase.co`                                             | Auth, REST, Realtime, Storage public URLs. Also `frame-src`: booking and verification PDF previews are iframes of signed Storage URLs | `VITE_SUPABASE_URL` (hosted project) |
| `wss://*.supabase.co`                                               | Realtime subscriptions                                                                                                                | Supabase client                      |
| `https://challenges.cloudflare.com`                                 | Turnstile widget script                                                                                                               | `turnstileLoader.ts`                 |
| `https://www.google.com` / `https://maps.google.com`                | Map embed iframes, directions links                                                                                                   | Property map components              |
| `https://maps.googleapis.com`                                       | Static map images (chat link cards)                                                                                                   | `ChatMapLinkCard.tsx`                |
| `https://maps.googleapis.com` / `https://maps.gstatic.com` (script) | Google Maps JS on listing pages                                                                                                       | `google-maps` loader                 |
| `https://us.i.posthog.com` / `https://us-assets.i.posthog.com`      | PostHog flags + lazy scripts (exception autocapture, web vitals) when the `/ingest` proxy is not used                                 | `posthog-js`                         |
| `data:` (connect, media)                                            | Booking form image optimizer reads a `data:` URL; for-hosts film inline audio                                                         | `imageOptimization.ts`, tour film    |
| `https://www.openstreetmap.org`                                     | OSM embed fallback                                                                                                                    | `propertyMapEmbed.ts`                |
| `https://staticmap.openstreetmap.de`                                | Static map preview tiles                                                                                                              | `parseChatRichBlocks.ts`             |
| `https://generativelanguage.googleapis.com`                         | Voice receptionist WebSocket (when enabled)                                                                                           | `voiceReceptionistApi.ts`            |
| `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/`     | Live ID liveness bundle + wasm. Exact path only; a bare `cdn.jsdelivr.net` is not allowed                                             | `faceLandmarker.ts`                  |
| `https://storage.googleapis.com/mediapipe-models/face_landmarker/`  | Liveness model. Exact path only; a bare `storage.googleapis.com` is not allowed                                                       | `faceLandmarker.ts`                  |

Not loaded as third-party script tags in production UI: PayMongo (redirect/checkout), Meta OAuth (full redirect), Resend (server only).

CSP policy source: `ui/vercel.json` → `Content-Security-Policy` (enforcing). No inline scripts or handlers: theme boot is `ui/public/theme-init.js`, font swap is `ui/public/async-styles.js`, guarded by `scripts/dev/check-csp-theme-hash.sh` (Vite rewrites inline script whitespace at build time, so a hash would drift). Enforced-policy check 2026-10-19 (Chromium, header injected on a local prod build): 0 own-origin violations on `/`, `/search`, `/properties`, listing, booking form, `/parkings`, `/for-hosts`, pricing, `/about`; only Cloudflare's challenge frame logs `data:` under its own policy. The policy has been enforcing since 2026-11-20 (PR-012); doc 22 is closed by `bun run test:e2e:csp` plus the deployed-preview header check.

## Content-Security-Policy: enforcing (2026-11-20, PR-012)

`ui/vercel.json` sends `Content-Security-Policy` (it was Report-Only). Rules for changing it:

- **Test it in a real browser.** `bun run test:e2e:csp` builds the app, serves it with the exact headers from `vercel.json` (`ui/vite-plugins/cspPreview.ts`, preview only, opt-in with `CSP_PREVIEW=1`), runs the mocked `@smoke`/`@ci` suite, and fails on any violation the browser reports. The only differences from production are the local Supabase origin in `connect-src` and a `report-uri` to a local endpoint.
- **Contract spec.** `ui/e2e/features/security/cspEnforced.spec.ts` probes every resource kind the app uses (Supabase PDF iframe, Maps, Turnstile, fonts, workers, `data:` and `blob:`) and checks that inline script, eval, foreign scripts, frames, forms and `<base>` are still refused. Add a probe for any new third party.
- **Unit contract.** `ui/src/lib/security/cspPolicy.test.ts` pins the strict directives and the allow-lists.
- **Visitor monitoring.** `ui/src/lib/security/cspViolationReporter.ts` sends a `csp_violation` PostHog event (directive and blocked origin only, one per pair, 10 per page load).
- **Rollback.** Rename the header key back to `Content-Security-Policy-Report-Only` in `ui/vercel.json` and redeploy. `check-vercel-headers.sh` and `verify-deployed-preview.mjs` enforce the enforcing name, so update them in the same change.
- `object-src 'none'` stays: real Chrome renders PDFs in iframes under it.
- `Permissions-Policy` was `camera=()`, which blocks `getUserMedia` for the live ID capture. It is now `camera=(self)`.
