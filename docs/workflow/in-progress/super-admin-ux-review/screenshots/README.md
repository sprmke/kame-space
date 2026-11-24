# Screenshots

Real local data, seeded super admin, captured by `../review.mjs`.

Widths: `phone` 390×844, `tablet` 820×1180, `desktop` 1440×900.

Kept here as the reference set for the findings in `../README.md`. Any of the 87
captures can be regenerated:

```bash
node docs/workflow/in-progress/super-admin-ux-review/review.mjs
```

| Shot                          | Shows                                                   |
| ----------------------------- | ------------------------------------------------------- |
| `desktop--overview`           | KPI grid, growth chart, plan mix, attention panel       |
| `desktop--orgs`               | Table view, MRR column, plan badge                      |
| `desktop--org-hub`            | Anchored section nav, stat cards, verification, billing |
| `desktop--hosts`              | Numeric column spacing                                  |
| `desktop--developments`       | Toolbar with view toggle                                |
| `desktop--support`            | Ticket table, row action icon                           |
| `desktop--audit`              | Raw action keys and relative timestamps                 |
| `desktop--marketing-trends`   | Machine error string in a run row                       |
| `desktop--faqs`               | Full-answer rows and triple icon actions                |
| `desktop--announcements`      | Empty SCHEDULE column                                   |
| `desktop--rate-limits`        | Disabled destructive button                             |
| `desktop--ai-controls`        | Toggle wall and blank numeric fields                    |
| `phone--overview`             | KPI cards on skeleton, range toggle                     |
| `phone--orgs`                 | Orphan rows-per-page select, plural bug                 |
| `phone--support`              | Summary cards push the list below the fold              |
| `phone--properties`           | Photo-first list rows                                   |
| `phone--audit`                | Four stacked filters                                    |
| `phone--health`               | Wrapped section pills, bar without legend               |
| `phone--feature-availability` | Edge function names as help text                        |
| `phone--ai-usage`             | Tab row wrapping 4 + 1                                  |
| `tablet--approvals`           | Two-column stat grid at 820px                           |
| `tablet--pricing-plans`       | Name plus internal plan code                            |
| `tablet--platform-settings`   | Explanatory paragraphs per toggle                       |
| `tablet--org-hub`             | Duplicated Subscription heading                         |
