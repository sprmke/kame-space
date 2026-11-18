---
title: 'Intake'
status: active
tags: [workflow, intake]
updated: 2026-11-18
stage: intake
kind: reference
---

# Intake

Active design specs (`<slug>-design.md`) and the two permanent scratchpads:

| Doc                                                                | Purpose                                                                             |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [`_to-prompt.md`](./_to-prompt.md)                                 | Prompt-ready backlog with status emojis. Moves to `done/` when shipped.             |
| [`_to-plan.md`](./_to-plan.md)                                     | Items that need a written plan before implementation.                               |
| [`_to-dos.md`](./_to-dos.md)                                       | Priority, pre-release and post-release tasks with status emojis.                    |
| [`ui-improvements-worksheet.md`](./ui-improvements-worksheet.md)   | Claim sheet for open UI polish so sessions do not collide with in-progress modules. |
| [`ui-improvements-backlog-cleanup-review.md`](./ui-improvements-backlog-cleanup-review.md) | Per-item review notes for the shipped UI improvements batch.                |

Design specs move with their plan when it starts, ships or is cancelled. Do not leave `stage: done` files here.

**Scratchpad emojis:** ❌ cancelled · ✅ done · 🧪 for testing · 📋 planned · 🚧 in progress · 🔵 open. Items are sorted ❌ → ✅ → 🧪 → 📋 → 🚧 → 🔵. Run `bun run sync:workflow-scratchpads` after moving a workflow doc, then `bun run check:workflow-scratchpads`.

Back to [workflow index](../README.md).
