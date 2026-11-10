---
title: 'SEO operations runbook'
status: active
tags: [operations, seo, search-console, bing, indexnow]
updated: 2026-11-11
---

# SEO operations runbook

Monthly checks and the one-off console work that keeps the public site discoverable in Google,
Bing, and AI answer engines. Architecture: [`docs/architecture/seo.md`](../../architecture/seo.md).

## Who has access

| Surface                                                                              | Owner          | Backup        |
| ------------------------------------------------------------------------------------ | -------------- | ------------- |
| Google Search Console (domain property `kamespace.com`, DNS TXT verified 2026-11-03) | platform owner | one org admin |
| Bing Webmaster Tools                                                                 | platform owner | one org admin |
| Google Business Profile (if claimed)                                                 | platform owner | none          |

Record any change of owner here in the same PR that changes access.

## One-off setup (do once, then tick)

- [ ] Submit `https://kamespace.com/sitemap.xml` in Search Console.
- [ ] If the old `kamehomes.space` property is still verified, run **Change of Address** to
      `kamespace.com`. The 301s already exist in `ui/vercel.json`.
- [ ] Import the Search Console property into Bing Webmaster Tools and submit the sitemap.
- [ ] Publish the IndexNow key: set `INDEXNOW_KEY` on Vercel, then confirm
      `https://kamespace.com/<key>.txt` returns the key.
- [ ] Provision the IndexNow cron: Vault secret `indexnow_cron_secret`, edge env
      `INDEXNOW_CRON_SECRET`, and a weekly `pg_cron` job hitting `indexnow-submit`.
- [ ] Rich Results Test and `validator.schema.org` for one URL per type (stay, parking,
      development, place, host, `/for-hosts/pricing`, `/support`). Save screenshots to
      `docs/workflow/in-progress/seo-evidence/`.

## Monthly checklist

1. **Page indexing** — Search Console → Indexing → Pages. Anything in "Excluded" that should be
   indexed gets a finding; anything newly "Soft 404" means a listing was deleted without a
   redirect.
2. **Core Web Vitals** — Search Console → Experience → Core Web Vitals, and
   `scripts/performance/lighthouse-routes.mjs` for the public routes. Targets at p75: LCP under
   2.5 s, INP under 200 ms, CLS under 0.1 on mobile.
3. **Enhancements** — breadcrumbs and structured-data errors. A spike usually means a new
   template emitted a field the validator rejects.
4. **Manual actions** — must stay empty.
5. **Top queries** — note any page that ranks for a query it does not answer; that is a copy or
   canonical bug.
6. **Bing** — the same four sections in Bing Webmaster Tools.
7. **Crawl audit drift** — run both and diff against the previous file:

   ```bash
   bun run seo:audit -- --origin https://kamespace.com --limit 200
   ```

   New `orphan`, `canonical-mismatch`, `h1-count`, or `thin-crawler-html` rows are regressions.

8. **llms.txt** — open `https://kamespace.com/llms.txt` and confirm the place list is current
   and no listing line contains contact data.

## After any deploy that touches SEO

```bash
bun run seo:audit -- --origin https://<preview-url> --fail-on-error
```

Checks the preview before it promotes: status codes, titles, descriptions, canonical, one
`<h1>`, images with alt, JSON-LD parse, and that a browser user agent does not receive the
crawler snapshot.

## When something breaks

| Symptom                                       | Likely cause                                          | Fix                                                                                          |
| --------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Every page shows the SPA shell to bots        | Middleware env missing `VITE_SUPABASE_URL` / anon key | Check the Vercel project env, then `curl -A "GPTBot" https://kamespace.com/about`            |
| `robots.txt` says `Disallow: /` on production | Host not in `DEFAULT_INDEXABLE_HOSTS`                 | Add the host, or fix the domain                                                              |
| Canonical points at a preview host            | `VITE_CANONICAL_APP_ORIGIN` set to a preview          | Unset it; the default is the apex                                                            |
| A renamed listing 404s                        | `listing_slug_redirects` empty                        | Check the trigger exists (`pg_trigger`) and that the rename went through an `UPDATE OF slug` |
| Sitemap lists a page that is `noindex`        | Registry and page disagree                            | Flip `indexable` in `publicRoutes.ts`, then `bun run check:seo-routes`                       |
