---
title: 'Stash archive'
status: archived
tags: [archive, git, wip, workflow]
updated: 2026-11-21
kind: reference
---

# Stash archive

Every stash that existed on 2026-11-21 is now also a named branch under
`archive/stash-*`, so the work cannot be lost if a stash is dropped or the stash stack
is cleared. The branches point at the stash commit; they are **archives**, not merge
candidates. They are local refs on this machine; push one only if you need it elsewhere.

## How to inspect

```bash
git branch --list 'archive/stash-*'
git log -1 --stat 'archive/stash-2026-11-14-1-on-perf-fix-boot-counting-wip-before-her'
git checkout 'archive/stash-2026-11-14-1-on-perf-fix-boot-counting-wip-before-her'
```

Return with `git switch <your-branch>`. Do not merge an archive branch wholesale; take the
specific files you want.

## Disposition of the recent stashes

| Stash                       | Disposition                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `stash@{0}` (2026-11-16)    | Landing redesign WIP, parked with draft PR #495.                                                                                             |
| `stash@{1}` (2026-11-14)    | Marketing AI Studio + shared UI. 64 of 79 UI/doc files are byte-identical in #488; the auth/profile batch was restored to `develop` in #564. |
| `stash@{2}` (2026-11-09)    | Codex tooling and marketing-home WIP, mostly superseded.                                                                                     |
| `stash@{3}` to `stash@{5}`  | One-file docs/todo edits.                                                                                                                    |
| `stash@{6}` to `stash@{34}` | Pre-cutover snapshots from Sep–Nov. Treat as historical.                                                                                     |

## Full mapping

| Branch                                                                 | Stash        | Date                      | Files | Subject                                                                                              |
| ---------------------------------------------------------------------- | ------------ | ------------------------- | ----- | ---------------------------------------------------------------------------------------------------- |
| `archive/stash-2026-11-16-0-on-feat-public-landing-redesign-wip-rema`  | `stash@{0}`  | 2026-11-16 09:40:41 +0800 | 108   | On feat/public-landing-redesign: wip-remaining-after-landing-redesign-commit 20261116-094041         |
| `archive/stash-2026-11-14-1-on-perf-fix-boot-counting-wip-before-her`  | `stash@{1}`  | 2026-11-14 00:09:37 +0800 | 166   | On perf/fix-boot-counting: wip-before-hero-fix                                                       |
| `archive/stash-2026-11-09-2-on-feat-marketing-home-codex-tooling-com`  | `stash@{2}`  | 2026-11-09 02:26:36 +0800 | 84    | On feat/marketing-home: codex tooling compat (draft PR #340) - parked before prod release 2026-11-09 |
| `archive/stash-2026-11-08-3-wip-on-release-prod-2026-11-08-0a48592b0`  | `stash@{3}`  | 2026-11-08 19:11:44 +0800 | 1     | WIP on release/prod-2026-11-08: 0a48592b0 docs: record the identity purge cron schedule              |
| `archive/stash-2026-11-04-4-on-fix-sentry-triage-2026-11-04-user-tod`  | `stash@{4}`  | 2026-11-04 14:53:16 +0800 | 1     | On fix/sentry-triage-2026-11-04: user todo edit                                                      |
| `archive/stash-2026-11-03-5-on-develop-concurrent-edits`               | `stash@{5}`  | 2026-11-03 10:55:50 +0800 | 1     | On develop: concurrent edits                                                                         |
| `archive/stash-2026-11-01-6-on-develop-wip`                            | `stash@{6}`  | 2026-11-01 18:01:54 +0800 | 1118  | On develop: wip                                                                                      |
| `archive/stash-2026-11-01-7-on-develop-agent-wip-before-seed-fix-pus`  | `stash@{7}`  | 2026-11-01 05:02:08 +0800 | 58    | On develop: agent-wip-before-seed-fix-push                                                           |
| `archive/stash-2026-10-25-8-on-develop-wip-assistant-template-attach`  | `stash@{8}`  | 2026-10-25 03:58:22 +0800 | 2     | On develop: wip-assistant-template-attach                                                            |
| `archive/stash-2026-10-25-9-on-no-branch-wip-detached-head-179287160`  | `stash@{9}`  | 2026-10-25 03:53:21 +0800 | 15    | On (no branch): wip-detached-head-1792871601                                                         |
| `archive/stash-2026-10-24-10-on-develop-wip-after-half-assistant-gues` | `stash@{10}` | 2026-10-24 17:02:01 +0800 | 253   | On develop: wip-after-half-assistant-guest-batch                                                     |
| `archive/stash-2026-10-22-11-on-develop-wip-after-marketing-health-qu` | `stash@{11}` | 2026-10-22 08:30:44 +0800 | 510   | On develop: wip-after-marketing-health-quarter-batch                                                 |
| `archive/stash-2026-10-21-12-on-develop-preserve-wip-before-history-r` | `stash@{12}` | 2026-10-21 21:34:30 +0800 | 597   | On develop: preserve-wip-before-history-rewrite                                                      |
| `archive/stash-2026-10-21-13-on-develop-wip-after-accidental-commits`  | `stash@{13}` | 2026-10-21 21:32:05 +0800 | 597   | On develop: wip-after-accidental-commits                                                             |
| `archive/stash-2026-10-21-14-on-develop-status-check`                  | `stash@{14}` | 2026-10-21 08:21:16 +0800 | 450   | On develop: status-check                                                                             |
| `archive/stash-2026-10-21-15-on-develop-v8`                            | `stash@{15}` | 2026-10-21 08:12:55 +0800 | 450   | On develop: v8                                                                                       |
| `archive/stash-2026-10-21-16-on-develop-pre-batch`                     | `stash@{16}` | 2026-10-21 07:54:15 +0800 | 544   | On develop: pre-batch                                                                                |
| `archive/stash-2026-10-20-17-on-develop-wip-before-date-split-2026-10` | `stash@{17}` | 2026-10-20 03:09:52 +0800 | 492   | On develop: wip before date split 2026-10-20                                                         |
| `archive/stash-2026-10-20-18-tracked-wip-snapshot-before-develop-ff-2` | `stash@{18}` | 2026-10-20 02:41:45 +0800 | 609   | tracked wip snapshot before develop ff 2026-10-20                                                    |
| `archive/stash-2026-09-28-19-on-develop-all-staged-wip`                | `stash@{19}` | 2026-09-28 00:19:48 +0800 | 894   | On develop: all-staged-wip                                                                           |
| `archive/stash-2026-09-24-20-on-feature-marketing-ai-image-quality-ha` | `stash@{20}` | 2026-09-24 15:33:22 +0800 | 142   | On feature/marketing-ai-image-quality-hardening: backup-before-move-to-develop                       |
| `archive/stash-2026-09-16-21-on-develop-wip-local-feature-work`        | `stash@{21}` | 2026-09-16 17:37:44 +0800 | 52    | On develop: wip-local-feature-work                                                                   |
| `archive/stash-2026-09-12-22-on-develop-pre-sync-develop-2026-09-12-1` | `stash@{22}` | 2026-09-12 16:57:00 +0800 | 163   | On develop: pre-sync develop 2026-09-12 16:56                                                        |
| `archive/stash-2026-09-04-23-on-develop-wip-org-settings-rbac`         | `stash@{23}` | 2026-09-04 07:45:40 +0800 | 6     | On develop: wip-org-settings-rbac                                                                    |
| `archive/stash-2026-09-02-24-on-develop-wip-before-develop-pull-20260` | `stash@{24}` | 2026-09-02 08:20:00 +0800 | 65    | On develop: wip-before-develop-pull-20260902                                                         |
| `archive/stash-2026-09-01-25-on-develop-temp-to-prompt-during-pop`     | `stash@{25}` | 2026-09-01 07:43:36 +0800 | 1     | On develop: temp-to-prompt-during-pop                                                                |
| `archive/stash-2026-09-01-26-on-develop-wip-before-develop-rebase-pus` | `stash@{26}` | 2026-09-01 07:41:09 +0800 | 12    | On develop: wip-before-develop-rebase-push                                                           |
| `archive/stash-2026-08-31-27-on-develop-wip-before-vercel-prod`        | `stash@{27}` | 2026-08-31 18:45:21 +0800 | 269   | On develop: wip before vercel prod                                                                   |
| `archive/stash-2026-08-30-28-wip-on-develop-72c47623-chore-deps-updat` | `stash@{28}` | 2026-08-30 05:01:12 +0800 | 142   | WIP on develop: 72c47623 chore(deps): update locks config and dev script utilities                   |
| `archive/stash-2026-08-29-29-on-develop-wip-investigate-develop`       | `stash@{29}` | 2026-08-29 23:16:52 +0800 | 381   | On develop: wip-investigate-develop                                                                  |
| `archive/stash-2026-08-24-30-on-develop-to-prompt-local`               | `stash@{30}` | 2026-08-24 03:38:33 +0800 | 1     | On develop: to-prompt-local                                                                          |
| `archive/stash-2026-08-24-31-on-develop-remaining-wip`                 | `stash@{31}` | 2026-08-24 03:34:28 +0800 | 184   | On develop: remaining-wip                                                                            |
| `archive/stash-2026-08-24-32-on-develop-all-wip`                       | `stash@{32}` | 2026-08-24 03:33:19 +0800 | 198   | On develop: all-wip                                                                                  |
| `archive/stash-2026-08-24-33-on-develop-temp`                          | `stash@{33}` | 2026-08-24 03:31:05 +0800 | 1     | On develop: temp                                                                                     |
| `archive/stash-2026-08-04-34-on-feature-support-multi-users-and-prope` | `stash@{34}` | 2026-08-04 01:14:56 +0800 | 28    | On feature/support-multi-users-and-properties: wip: pre merge-conflicts stash                        |

## Cleanup

After reviewing a branch, delete it with `git branch -d <branch>`. Keep the stash itself
until the branch is confirmed redundant. The durable restore record for deleted branches is
[`branch-cleanup-audit.md`](./branch-cleanup-audit.md).

Back to [operations index](./README.md).
