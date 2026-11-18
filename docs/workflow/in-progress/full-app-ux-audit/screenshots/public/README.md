# Public-surface screenshot library

Evidence for [28-public-surface-audit.md](../../28-public-surface-audit.md) and the issue register in
[29-issue-register.md](../../29-issue-register.md). Kept so an agent can open a finding and see the exact
state it describes without re-running the app.

## Naming

```
<group>__<route-id>__<viewport>.jpg
```

| Part       | Values                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------- |
| `group`    | `marketing`, `for-hosts`, `listings`, `guest-flow`, `auth`, `account`, `admin-gap`            |
| `route-id` | kebab-case route slug, e.g. `for-hosts-pricing`, `property-detail`, `form-signed-in`          |
| `viewport` | `s320` (320x700), `m390` (390x844), `t768` (768x1024), `l1024` (1024x800), `d1440` (1440x900) |

Example: `listings__property-detail__m390.jpg` is the listing detail page at 390px wide, full page.

All images are **full-page** JPEGs (quality 60-62, `deviceScaleFactor: 1`) captured with reduced motion,
cookie consent declined, and a signed-in session where the route needs one.

## What each group covers

| Group        | Routes                                                                                                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketing`  | home, v2, search, services, about, contact, support, terms, privacy, cookies, 404                                                                                                                                                        |
| `for-hosts`  | /for-hosts, /for-hosts/pricing, /for-hosts/v2, /for-hosts/v3, /explore-preview                                                                                                                                                           |
| `listings`   | properties, properties/in/:location, property detail, parkings, parking detail + form + request, developments (+properties, +parking), hosts/:orgSlug                                                                                    |
| `guest-flow` | calendar, form (anon + signed in), success, trip, stay-guide, showcase, messages, sd-form, guest-review, pay-parking, document                                                                                                           |
| `auth`       | for-hosts/login, for-guests/login, for-hosts/register, for-guests/register, accept-invite                                                                                                                                                |
| `account`    | profile, trips, messages, vouchers, reviews, favorites, tickets, tickets/new, help                                                                                                                                                       |
| `admin-gap`  | onboarding, verification-rejected, admin playbook/faqs/ai-usage/health/ops-reports/payment-settings/development, property tickets/docs/activity/announcements, org team, parking notifications/announcements/tickets, public-page editor |

## manifest.json

One record per route × viewport (271 records). Fields an agent will actually use:

| Field                           | Meaning                                                     |
| ------------------------------- | ----------------------------------------------------------- |
| `group`, `id`, `route`, `width` | identity                                                    |
| `height`                        | full document height in CSS px                              |
| `h1`, `headings`, `skips`       | visible outline, and count of skipped levels                |
| `textLen`                       | visible text length (proxy for content density)             |
| `dialogs`, `dialogText`         | an auth sheet or modal is open on load                      |
| `contrastCount`, `contrast[]`   | text below its WCAG threshold, with ratio, size and opacity |
| `smallCount`, `smallTargets[]`  | interactive elements under 44x44                            |
| `brokenImages[]`, `imgNoAlt`    | failed images and missing alt                               |
| `unnamedControls`               | icon-only buttons/links with no accessible name             |
| `overflowX`, `overflowEls[]`    | horizontal overflow and the elements causing it             |
| `stickyCovered[]`               | controls sitting under a fixed bottom bar                   |
| `file`, `bytes`                 | the screenshot                                              |

## Subfolders

| Folder   | Contents                                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(root)_ | the numbered capture set, one file per route × viewport, listed in `manifest.json`                                                                                                                                        |
| `live/`  | 34 interaction captures taken during the critique: open menus, sheets, hover states, 320px scrolled views, form steps 1-5 (`step-01-guest.jpg` … `step-05-payment.jpg`), verification shots such as `verify-nav-1024.png` |
| `data/`  | `consistency.json` (nav and footer variants per route) and `linkcheck.json` (83 internal links with status, final URL, page length)                                                                                       |

## Regenerating

The capture harness lives outside the repo (`/tmp/audit/p4b/capture.mjs`). It needs the local stack running
(`./dev.sh`), the canonical seed, and it writes here. If you re-run it, keep `deviceScaleFactor: 1`,
`reducedMotion: 'reduce'`, and JPEG quality ≤ 62 so the folder stays under ~30 MB.
