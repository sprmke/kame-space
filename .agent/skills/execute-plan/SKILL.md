---
name: execute-plan
description: >-
  Take a plan from written to PR-ready on its own: audit and harden the plan,
  set up an isolated git worktree, implement every phase, and verify to
  production standard. Use when the user runs /execute-plan, or says "start
  working on this plan", "execute the plan", "review the plan then build it",
  or "do the whole thing without asking me again".
disable-model-invocation: true
---

# Execute plan (autonomous, isolated)

Turn one written plan into a reviewed, hardened, fully implemented, verified branch in an
isolated worktree, without asking the user for decisions along the way.

**Announce:** `Using execute-plan to run <plan title>`.

**Core principle:** the plan is a draft until you have checked it against the code that exists
today. Audit, fix the plan, then build. Never build a plan you have not verified.

## Invocation

```text
/execute-plan <slug | path | freeform description>
```

| Flag                | Effect                                                              |
| ------------------- | ------------------------------------------------------------------- |
| `--in-place`        | Work in the current checkout. Only when the tree is clean.          |
| `--plan-only`       | Run Phases 0 to 2 and stop after the plan is hardened.              |
| `--worktree <name>` | Use `.worktrees/<name>` instead of deriving one from the slug.      |
| `--no-pr`           | Stop after Phase 5 verification; leave the branch pushed but no PR. |

No argument: use the plan already named in the conversation, or the single **`docs/workflow/planned/`**
doc changed most recently. If two or more candidates are plausible, pick the one whose title
matches the conversation and say which you chose. Do not ask.

---

## Phase 0: Resolve the input

1. **Find the plan.**

   | Input                  | Where to look                                          |
   | ---------------------- | ------------------------------------------------------ |
   | Slug, e.g. `booking-x` | `docs/workflow/{planned,in-progress,intake}/<slug>.md` |
   | Path                   | Read it directly                                       |
   | Freeform description   | No plan yet, write one in Phase 2 from the request     |

   Order: `in-progress/` (already started) → `planned/` → `intake/` (`<slug>-design.md`).

2. **Read the whole file.** Frontmatter, every phase, every table, the docs list, the
   verification section. Note the `status`, `readiness`, `launch_gate`, `launch_blocker` fields.

3. **Read the code it touches.** For every file path, function, table, edge function, and
   component the plan names, confirm it still exists and still behaves as described. Record
   drift. This is the single highest-value step: plans rot, and a stale plan silently produces
   a wrong implementation.

4. **Read the rules that own the surface**, from the plan's own topic:
   `.cursor/rules/booking-workflow.mdc` (status/email/PDF), `admin-auth.mdc` (JWT, allow list),
   `plans-and-permissions.mdc` (tiers, RBAC), `audit-logging.mdc` (mutations),
   `mobile-native-ui.mdc` + `unsaved-changes.mdc` + `skeleton-loaders.mdc` (UI),
   `observability.mdc` (Sentry/PostHog), `supabase-edge-functions.mdc`,
   `parking-workflow.mdc`, `no-prod-deploy.mdc`.

---

## Phase 1: Audit the plan

Score the plan against this list. Anything missing or wrong is a finding you fix in Phase 2.

| Check               | Question                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Drift**           | Does every named path, symbol, column, and endpoint still exist?                            |
| **Scope**           | Is every phase actually required by the goal? Is anything missing that the goal implies?    |
| **Ordering**        | Can each phase ship and be verified on its own? Are dependencies real?                      |
| **Data**            | Migrations? New columns? Backfill? Is the rollback path stated?                             |
| **Access**          | Plans tier gate and Team RBAC leaf decided, or explicitly `N/A — <why>`?                    |
| **Audit**           | Every mutation emits `activity_log`, or `N/A — <why>`?                                      |
| **Observability**   | Fault path to Sentry seam, outcome event in both PostHog catalogs, or `N/A — <why>`?        |
| **Docs**            | Route guide, Host-facing Q&A, `faqs.md`, `PROJECT.md`, architecture doc, plan file?         |
| **Loading**         | Skeleton rows for every async region that changes?                                          |
| **Mobile**          | Bottom sheets, 44px targets, 375px verified?                                                |
| **Unsaved changes** | Guard on every manual-Save form or dirty modal?                                             |
| **Edge cases**      | Empty, loading, error, offline, permission-denied, concurrent write, plan-locked, archived? |
| **Verification**    | Every phase has a command that proves it, not a description?                                |
| **Guest impact**    | Anything touching guest PII, tokens, money, or public reads called out explicitly?          |
| **Rollback**        | How to undo a bad ship, per phase?                                                          |

---

## Phase 2: Harden the plan (you may edit it)

You have standing permission to rewrite the plan document. Do it in the plan file itself, not in
chat.

1. **Fix every Phase 1 finding** in place. Prefer small edits over a rewrite; the plan's history
   matters.
2. **Add what is missing**, in the plan's own voice:
   - A `## Decisions` table for choices you make while executing (`decision | choice | why`).
   - Missing phases for gates the plan omitted (docs, tests, rollback).
   - A per-phase **Acceptance** line naming the exact command that proves the phase.
   - An **Edge cases** section if the plan only covers the happy path.
3. **Record the revision** at the top of the body:

   ```text
   > **Revised <YYYY-MM-DD> (execute-plan):** <one line per substantive change>
   ```

4. **Update frontmatter:** `updated: <YYYY-MM-DD>`. If you re-baselined success criteria, set
   `readiness:` and `last_verified:` honestly.
5. **If no plan existed**, write `docs/workflow/planned/<slug>.md` now: Goal, targets, phases
   with acceptance, decisions, docs list, verification, edge cases, risks.

Keep the plan readable: tables over prose, one idea per bullet, no restating the obvious.

---

## Phase 3: Isolated workstation

The point is to not collide with other sessions. Detect first, then create.

### 3.1 Already isolated?

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
test "$GIT_DIR" != "$GIT_COMMON" && echo "already in a worktree"
```

If you are already in a linked worktree, reuse it. Do not nest. If `--in-place` was passed and
`git status --porcelain` is clean, work in place.

### 3.2 Create it

Follow `.agent/skills/using-git-worktrees/SKILL.md`. Project convention:

```bash
git fetch origin
slug="<kebab-slug>"
path=".worktrees/${slug}"
git worktree add "$path" -b "feat/${slug}" origin/develop
cd "$path"
```

`.worktrees/` is already gitignored. Branch type: `feat/` for capability, `fix/` for defects,
`perf/` for the speed-class plans, `chore/` otherwise. Always branch from `origin/develop`, never
`main`.

### 3.3 Bring the gitignored files (do not skip)

A fresh worktree has **no** env files and **no** `node_modules`, so dev, tests, and the app itself
fail for reasons unrelated to your work. Copy them from the main checkout before doing anything
else.

```bash
main="$(cd "$(git rev-parse --git-common-dir)/.." && pwd -P)"
for f in ui/.env ui/.env.development ui/.env.development.dev \
         ui/.env.development.local ui/.env.local ui/.env.production \
         supabase/.env.local; do
  [[ -f "$main/$f" && ! -f "$f" ]] && mkdir -p "$(dirname "$f")" && cp "$main/$f" "$f"
done
bun install --frozen-lockfile
```

If `.opencode/` needs its own deps, install there too. Never commit anything from
`ui/.env*` or `supabase/.env.local`; they are gitignored and must stay that way.

### 3.4 Confirm the baseline

```bash
git status -sb          # clean apart from the copied (ignored) env files
bun run type-check
```

A broken baseline makes every later failure ambiguous. If the baseline fails, note it in the
plan's Decisions table as pre-existing and keep going; do not "fix" unrelated code.

### 3.5 Move the plan on the branch

The revision from Phase 2 and the lifecycle move both belong on this branch.

```bash
bash scripts/dev/workflow-move.sh start "$slug"
```

If the plan file is not in the worktree (it was untracked in the main checkout), copy it in and
commit it first: `docs: add <slug> plan`. Then run the move.

---

## Phase 4: Execute

Work phase by phase, in the plan's order. Per phase:

1. **Read** the code you are about to change. Not the plan's description of it.
2. **Implement** the whole phase. No partial phases with "TODO".
3. **Test** in the same commit: unit for pure logic, handler tests for branching edge functions,
   E2E for changed primary journeys. See `.cursor/rules/testing.mdc` for which layer.
4. **Gate:**

   ```bash
   bun run type-check
   bun run lint            # 0 errors
   ```

5. **Commit** small and complete. Conventional commit, no AI or co-author trailers
   (`git-commits.mdc`). One logical change per commit.

Rules while building:

- **Surgical diffs.** Every changed line traces to the plan. No drive-by refactors, no reformatting
  untouched lines, no dead-code sweeps you were not asked for.
- **Match the surrounding code.** Same primitives, same naming, same imports.
- **Follow the shared seams.** Booking side effects go through `workflowOrchestrator.transition()`;
  edge handlers through `serveAdmin` / `servePublic` / `serveCronPost`; errors to the existing
  capture seams. Never a private parallel path.
- **Reuse before writing.** If the repo already has a helper (label resolver, summary row, sheet
  primitive, guard hook), use it. Duplicating a helper the repo already owns is a defect.
- **New host capability** decides Plans + Team RBAC in the same change, or marks `N/A — <why>`.
- **New mutation** emits `activity_log`, or marks `activity-log: N/A — <why>`.
- **New UI** is designed at 375px first, uses `ResponsiveModal` / `MobileChoiceSheet` /
  `ResponsiveOverflowMenu` / `ContextualActionBar`, and is guarded by `useUnsavedChangesGuard`
  or `useGuardedClose` when it has a manual Save.
- **Loading states** keep page chrome and static labels; skeleton only the async values.
- **Guest-facing work** (PII, tokens, money, public reads) gets the strict pass in the next
  section, every time.
- **Docs in the same change.** Route guide, Host-facing Q&A, `faqs.md`, `PROJECT.md`,
  architecture doc, plan checkboxes. Not "later".

### Guest-sensitive pass

Run this whenever the plan touches guests, money, or public reads.

| Risk                  | Requirement                                                                       |
| --------------------- | --------------------------------------------------------------------------------- |
| Access scoping        | Guest reads and writes authorized by booking token, not by id alone               |
| PII in telemetry      | No email, phone, name, address, message body, or token in Sentry or PostHog       |
| Public endpoint abuse | `publicGetRateLimitGate` / `antiSpamGate` wired on new public handlers            |
| Cross-tenant leak     | Every query filtered by `organization_id` / `property_id` / `booking.property_id` |
| Money                 | Amounts computed once and snapshotted; never re-derived from live config          |
| Irreversible actions  | Confirm dialog, and an undo or a documented recovery path                         |
| Guest-visible copy    | Plain, short, no em dash, no AI tells (`human-copy.mdc`)                          |

---

## Phase 5: Verification

Prove it, do not assert it.

```bash
bun run ci:quality                        # full PR parity
bun run test:e2e:smoke                    # when a primary journey changed
bun run check:ai-tooling-sync             # when you touched commands/skills/rules
```

Then walk the plan's acceptance lines one by one and record the real result per row. For UI work,
actually load the routes at **375 / 768 / 1024px** and inspect them; a type-check cannot see a
wrapped summary row.

Optionally run `/self-review` on the diff before opening the PR. It is cheaper than a review round
trip.

Record results in the plan: tick phases, and add a short `## Verification results` block with
`gate | result`.

---

## Phase 6: Land

Follow `.cursor/rules/branch-lifecycle.mdc`:

```bash
git status --porcelain        # empty
git push -u origin HEAD
gh pr create --base develop --fill
```

Report the PR URL. **Do not merge.** Merging is the user's decision; ask, then act on the answer.
After a merge, delete the branch and the worktree.

Unless `--no-pr`: stop after Phase 5 and report the branch and worktree path.

---

## Decision policy (no prompting)

The user has pre-authorized decisions. Make them and move on.

**Decide yourself and record it** in the plan's `## Decisions` table:

- Naming, file layout, component boundaries within the plan's own structure
- Copy wording (via `human-copy` rules)
- Which test layer covers a change
- Phase ordering and splitting a phase into two commits
- How to resolve plan drift against current code
- Whether a section needs `embedded` / a Manage modal / a summary row, judged against neighbours
- Trimming plan scope that the goal does not require, when it is clearly speculative

**Never decide alone — stop and report as blocked:**

- Production Supabase, database, or edge function deploys. **`kamewave` is required and only the
  user can give it.** Complete everything up to the deploy, then report the exact command and what
  remains. Never run or recommend it as a casual next step.
- Force-pushing or rewriting shared history
- Deleting branches or worktrees you did not create
- Dropping or backfilling production columns outside a reviewed migration in the branch
- Anything that charges a guest or a host money in a way the plan does not specify

When blocked, keep the rest of the work moving and report the blocker at the end with what is
still required. Do not sit idle waiting for an answer.

---

## Don'ts

- Do not build a plan you have not audited against the current code.
- Do not ask the user to choose between options the repo already answers.
- Do not touch other worktrees, branches, or another session's uncommitted files.
- Do not run `git add -A` on a large dirty tree.
- Do not edit a shipped migration; add a new one.
- Do not merge, do not deploy to production, do not add AI or co-author attribution.
- Do not claim a phase complete when its gate did not run or did not pass.

## Report at the end

Use the `agent-reporting` shape: one outcome line with the PR URL, then **What changed**,
**Verification** (real gate results), **Docs**, **Notes** (uncommitted files, skipped gates,
pre-existing failures, anything needing `kamewave`, `Plans/RBAC: N/A — <why>`,
`activity-log: N/A — <why>`). One closing question at most.

## Related

- `docs-first` · `karpathy-guidelines` — read before building
- `writing-plans` — when no plan exists yet
- `using-git-worktrees` — Phase 3 mechanics
- `testing` · `self-review` · `branch-lifecycle` · `agent-reporting`
- Rules: `documentation-maintenance.mdc`, `route-guides.mdc`, `plans-and-permissions.mdc`,
  `audit-logging.mdc`, `mobile-native-ui.mdc`, `unsaved-changes.mdc`, `skeleton-loaders.mdc`,
  `observability.mdc`, `no-prod-deploy.mdc`, `git-commits.mdc`
