---
name: 'source-command-ks-execute-plan'
description: 'Migrated source command `ks-execute-plan`'
---

# source-command-ks-execute-plan

Use this skill when the user asks to run the migrated source command `ks-execute-plan`.

## Command Template

# ks-execute-plan

Run a written plan to completion: audit and harden the plan, isolate the workspace, implement every phase, verify, and open a PR.

## When to use

| User says                                                   | Action                        |
| ----------------------------------------------------------- | ----------------------------- |
| `/ks-execute-plan <slug-or-path>`                           | Run the skill below           |
| "Start working on this plan", "execute the plan"            | Same (confirm the slug first) |
| "Do the whole thing without asking me again"                | Same                          |
| "Work on it in a separate workstation so nothing conflicts" | Same — worktree is mandatory  |

Not for: a single ticket (`/ks-start-work`), or reviewing without implementing (`/self-review`).

## Steps (agent)

1. **Read and follow** `.agent/skills/execute-plan/SKILL.md` end to end. Do not improvise a lighter version.
2. Announce: `Using execute-plan to run <plan title>`.
3. Resolve the plan from the user message, else the most recently changed `docs/workflow/planned/` doc that matches. If two are plausible, pick the one whose title matches the conversation and say which — do not ask.
4. Follow the skill's phases 0 to 6. Report in the **`agent-reporting`** shape the skill specifies.

## Non-negotiables

- **Audit the plan against the code before building.** Plans rot; a stale plan silently produces a wrong implementation.
- **Isolate first.** Never implement in the main checkout while other sessions are active. `.worktrees/` is gitignored here; branch from `origin/develop`.
- **Copy gitignored env files** into the worktree. A fresh worktree has no `ui/.env*` or `node_modules`, so gates fail for reasons unrelated to the work.
- **No production Supabase command without `kamewave`.** Complete everything up to the deploy, then report the exact command and what remains.
- **Do not merge.** Report the PR URL and stop.

This command is available in chat as **/ks-execute-plan**
