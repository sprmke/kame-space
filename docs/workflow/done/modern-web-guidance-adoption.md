---
title: 'Modern Web Guidance adoption (closed)'
status: done
tags: [workflow, done, tooling, agents, web-platform]
updated: 2026-11-19
stage: done
kind: reference
---

# Modern Web Guidance adoption

**Closed 2026-11-19.** Google Chrome's [`modern-web-guidance`](https://developer.chrome.com/docs/modern-web-guidance) skill is installed once, globally, and every coding agent on this machine reads it. This file records the install, the scans that followed, what shipped, and what was deliberately not changed so a later pass does not re-litigate it.

## What it is

Not a dependency. It is an agent skill plus a CLI that returns expert-curated web platform guidance, and a `legacy-scan` command that flags outdated patterns. Stewarded by the Chrome, Edge, Firefox and MDN teams.

## Install (machine level, one copy)

| Surface | Location |
| --- | --- |
| Real files | `~/.agents/skill-library/modern-web-guidance` |
| Universal face | `~/.agents/skills/modern-web-guidance` → symlink |
| Agent faces | `~/.claude/skills`, `~/.cursor/skills`, `~/.config/opencode/skills` (symlinks); Codex reads the universal face |

Registered in `~/.agents/skill-catalog/manifest.json` as `visible: true`, and added to `SOURCES` in `~/.agents/bin/agent-stack.sh` so `agent-stack.sh update` keeps it current. `agent-stack.sh verify` reports all four providers resolving the same visible set.

Because it is user-level, every project under `~/Projects` picks it up with no per-repo install and no repo churn.

**Cost:** its description is injected into every request, about 225 tokens. The visible set is about 701 of the ~1200 token budget in the manifest.

**Telemetry:** on by default. Set `DISABLE_TELEMETRY=1` to opt out.

## Scans

`legacy-scan` was run across all eight repos with a remote: 235 findings.

| Repo | Findings | Outcome |
| --- | --- | --- |
| `kame-homes` (kame-space) | 181 | 38 applied |
| `kame-lends` | 26 | none safe |
| `kame-finance` | 11 | none safe |
| `kame-desk` | 7 | none safe |
| `kame-pick` | 6 | 3 applied |
| `kame-apply` | 3 | none safe |
| `kame-crew` | 1 | 1 applied |
| `kame-hunt` | 0 | clean, no remote |

`kame-shop` and `kame-tools` are not git repos. `kame-apply-ind-01`, `kame-apply-ind-review` and `kame-apply-setup-merge` are clones of `kame-apply`, so one branch covers all four.

The CLI truncates text output to five examples per rule. Always use `--json` when a rule reports more than five findings.

## Shipped

| Repo | PR | Contents |
| --- | --- | --- |
| `kame-space` | [#516](https://github.com/sprmke/kame-space/pull/516) | 38 fixes: IME-safe Enter handlers, `{ cause }` on rethrown errors, `AbortSignal.timeout()`, `structuredClone()` |
| `kame-space` | [#518](https://github.com/sprmke/kame-space/pull/518) | Release to `main`: 11 PRs, Vercel production and Supabase backend both deployed |
| `kame-pick` | [#2](https://github.com/sprmke/kame-pick/pull/2) | 3 fixes: password `autoComplete` hints, IME guard |
| `kame-crew` | [#2](https://github.com/sprmke/ai-personal-assistant-app/pull/2) | IME guard, plus an unrelated type error that blocked its production build |

## Deliberately not changed

Re-run `legacy-scan --json` and apply these only if the tradeoff changes.

| Rule | Count | Why |
| --- | --- | --- |
| `js/copying-array-methods` | 177 | Needs `lib: ES2023` per repo and touches over 100 files. Mechanical and type-check catches misuse, but it was declined to keep reviews small. |
| `dark-mode`, `dark-mode-toggle` | 6 | One is the Supabase auth email template; the rest change the theme mechanism. Both alter rendering. |
| `form-fields-automatically-fit-contents` | 3 | `field-sizing: content` is not safe on the mobile Safari versions guests use. |
| `dynamic-sibling-animations` | 1 | `sibling-index()` is not Baseline yet. |
| `switch` | 1 | The native `switch` attribute is not Baseline yet. |
| `js/text-decoder` | 1 | The helper only decodes short ASCII magic bytes; changing encoding risks MIME sniffing for no gain. |
| `js/object-group-by`, `js/promise-with-resolvers` | 2 | Need `lib: ES2024`. |
| `js/structured-clone` in `planPricing_test.ts` | 1 | The JSON round-trip there intentionally simulates a database read. |
| `js/error-cause` in `ui/src/lib/pwa/push.ts` | 1 | `ErrorOptions` needs `lib: ES2022`. |

## Known open item

`kame-crew`'s Vercel production deploy fails. The merged code builds cleanly locally with `.env.local` (all 20 routes prerender), so the cause is Vercel project config, most likely the three competing lockfiles (`bun.lock`, `package-lock.json`, `pnpm-lock.yaml`). Its `main` was already failing before this work. Left as is by decision on 2026-11-19; fix it when Vercel access is available.

## How to use it

The skill triggers on its own for HTML, CSS and client-side JavaScript work. Manually:

```sh
npx modern-web-guidance@latest search "responsive data table"
npx modern-web-guidance@latest retrieve "<id>"
npx modern-web-guidance@latest legacy-scan . --json
```

## Related

- Documentation rule: [`.cursor/rules/documentation-maintenance.mdc`](../../../.cursor/rules/documentation-maintenance.mdc)
- Machine skill stack: `~/.agents/bin/agent-stack.sh`
- Deployment truth: [`../../architecture/deployment.md`](../../architecture/deployment.md)
