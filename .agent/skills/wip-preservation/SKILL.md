# Skill: wip-preservation

# WIP preservation

Canonical rule: **`.cursor/rules/wip-preservation.mdc`**.

**Core principle:** uncommitted work is never disk clutter. It is unfinished work. Preserve it
on a named branch before any stash, reset, branch delete, or worktree removal.

## Before a destructive command

Run:

```bash
bun run wip:save <short-name>
```

It commits the dirty tree to `wip/<date>-<short-name>` and returns to the original branch.
Then the destructive command is safe.

If the command is `git stash drop`, `git stash clear`, `git branch -D`, `git reset --hard`,
`git clean -fd`, or `git worktree remove --force`, the shell hooks deny it while any worktree
is dirty. The deny message repeats the `wip:save` path.

## If a stash already exists

A stash is not storage. In the same session:

```bash
git stash list
git stash show -p 'stash@{0}'
git stash branch wip/<date>-<name> 'stash@{0}'
```

That creates a branch, checks it out, and applies the stash. Commit anything left over.

## Before cleanup or session end

```bash
bun run wip:audit          # list stashes + dirty worktrees
bun run wip:audit --strict # exit 1 when anything is found
bun run branch:audit       # check branches before deleting
```

## Recovery

| Situation                 | Command                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- |
| Stash still exists        | `git stash branch wip/recover 'stash@{n}'`                                        |
| Commit lost from a branch | `git reflog`, then `git branch <name> <sha>`                                      |
| Branch was deleted        | Restore the tip SHA recorded in `docs/archive/operations/branch-cleanup-audit.md` |
| Worktree was removed      | `git worktree add <path> <sha>`                                                   |

## Do not

- Do not run `git stash` "just for a moment" without a WIP branch.
- Do not delete a branch because its name looks old.
- Do not remove a worktree with a dirty tree.
- Do not use `wipsafe` unless the owner explicitly said the work is disposable.
