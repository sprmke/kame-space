# HTTPS, host redirects and canonical origin — 2026-11-11

Read-only checks against production (`curl`, no writes). Item 16 of the SEO plan.

## HTTP to HTTPS (one hop, 308)

| Requested                     | Result                                 |
| ----------------------------- | -------------------------------------- |
| `http://kamespace.com/`       | `308` → `https://kamespace.com/`       |
| `http://www.kamespace.com/`   | `308` → `https://www.kamespace.com/`   |
| `http://kamehomes.space/`     | `308` → `https://kamehomes.space/`     |
| `http://www.kamehomes.space/` | `308` → `https://www.kamehomes.space/` |
| `http://app.kamespace.com/`   | no DNS record (host is not attached)   |

## Non-canonical hosts to the apex (one hop, 308)

| Requested                           | Result                                |
| ----------------------------------- | ------------------------------------- |
| `https://www.kamespace.com/about`   | `308` → `https://kamespace.com/about` |
| `https://kamehomes.space/about`     | `308` → `https://kamespace.com/about` |
| `https://www.kamehomes.space/about` | `308` → `https://kamespace.com/about` |
| `https://kamespace.com/about`       | `200`                                 |

Every public route therefore reaches the apex in at most two hops.

## Fixed by this branch

- `upgrade-insecure-requests` added to the CSP (still Report-Only).
- `VITE_CANONICAL_APP_ORIGIN` is the single canonical origin; the default is
  `https://kamespace.com`, so a preview or legacy host can never self-canonicalize.
- `www.kamespace.com` is also declared in `ui/vercel.json` so the behaviour survives a
  domain-config change.

## Not verifiable from here

- HSTS preload submission (`hstspreload.org`) needs the owner to confirm every
  `*.kamespace.com` subdomain is HTTPS-capable first. `includeSubDomains` is already set.
- DB-stored URLs (listing media, org logos, page-editor content) need a production read; run
  `bun run media:storage-audit` and search the `http://` prefix per bucket before any bulk
  rewrite.
