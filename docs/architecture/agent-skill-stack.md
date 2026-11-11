# Global agent skill stack

One skill library shared by every AI coding agent on the machine, so Claude Code, Cursor,
Codex and OpenCode behave the same way across every Kame project.

## Problem it solves

Each provider discovers skills by injecting the `name` and `description` from every
`SKILL.md` it can see into the model context. Installing 150+ skills into all four
providers means paying for 150+ descriptions on every single request, whether or not the
task needs them. That is roughly 4,000 tokens per request, forever.

The stack keeps all 159 skills installed but makes only a small curated set visible.

## Shape

```
~/.agents/skill-library/<skill>/SKILL.md   159 skills, real files, one copy on disk
~/.agents/skills/<skill>                   curated face (Codex reads this directly)
~/.claude/skills/<skill>    ─┐
~/.cursor/skills/<skill>     ├─ symlinks into the curated face
~/.config/opencode/skills/<skill> ─┘
```

| Path                                          | Role                                                               |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `~/.agents/bin/agent-stack.sh`                | Manager: `install`, `curate`, `status`, `verify`, `list`, `update` |
| `~/.agents/bin/wire-repo.sh`                  | Adds the global-skill pointer to one repo's agent docs             |
| `~/.agents/skill-catalog/manifest.json`       | Which skills are visible, and their category                       |
| `~/.agents/skill-catalog/build-manifest.sh`   | The editable `VISIBLE` list that generates the manifest            |
| `~/.agents/skill-catalog/GLOBAL-SKILLS.md`    | Short operator guide                                               |
| `~/.agents/skill-library/agent-skills-index/` | Router skill: task to library skill                                |

## Token budget

| Set                      | Count | Cost per request |
| ------------------------ | ----- | ---------------- |
| Visible (every provider) | 5     | ~161 tokens      |
| Library (loaded by name) | 154   | 0 until used     |

The five visible skills are chosen because they change behaviour on almost every task:

| Skill                            | Why always on                                                             |
| -------------------------------- | ------------------------------------------------------------------------- |
| `ponytail`                       | Smallest change that solves the task, no speculative code                 |
| `investigate-first`              | Diagnose before editing on ambiguous failures                             |
| `surgical-patch`                 | Fix at the narrowest responsible layer                                    |
| `verification-before-completion` | Never claim done without running the gate                                 |
| `agent-skills-index`             | Maps a task to the other 154 skills without paying for their descriptions |

## Provider discovery, verified

| Provider    | Global dir                                                        | Confirmed by                                                                         |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Claude Code | `~/.claude/skills`                                                | registry in `skills` CLI (`globalSkillsDir: claudeHome/skills`)                      |
| Cursor      | `~/.cursor/skills`                                                | registry in `skills` CLI (`globalSkillsDir: home/.cursor/skills`)                    |
| Codex       | `~/.agents/skills`, `~/.codex/skills`                             | strings in the Codex binary                                                          |
| OpenCode    | `~/.config/opencode/skills` plus claude/agents compatibility dirs | binary scans `**/SKILL.md` and follows symlinks; compatibility dirs resolve `skills` |

OpenCode follows symlinks, so the symlinked face works without extra config, and no
absolute paths are written into any repo's committed config.

## Ownership rule

`curate` only prunes a universal-face entry when the name appears in the manifest **and**
is no longer marked visible. Agent-owned skills (Cursor's `skills-cursor` bundle,
Claude's `synced` directory, `.kits`) are never touched. A regression test in
`scripts/dev/check-agent-stack.sh` asserts their survival.

## Operating it

```bash
~/.agents/bin/agent-stack.sh status     # what is visible and what it costs
~/.agents/bin/agent-stack.sh list       # full catalogue with visibility
~/.agents/bin/agent-stack.sh install    # pull latest from all upstream repos
~/.agents/bin/agent-stack.sh curate     # re-link providers after editing the manifest
~/.agents/bin/agent-stack.sh verify     # assert all four providers agree
bun run check:agent-stack               # health check (same assertions, CI-safe)
```

To make a library skill visible, add it to `VISIBLE` in
`~/.agents/skill-catalog/build-manifest.sh`, rebuild, then `curate`.

## Sources

Skills come from these upstream repositories, all installed into the library:

`obra/superpowers`, `DietrichGebert/ponytail`, `JuliusBrussee/caveman`, `mattpocock/skills`,
`addyosmani/agent-skills`, `anthropics/skills`, `blader/humanizer`, `morluto/rea`,
`tt-a1i/archify`, `cathrynlavery/diagram-design`, `Egonex-AI/Understand-Anything`,
`Nutlope/hallmark`, `Panniantong/Agent-Reach`, `pbakaus/impeccable`, `Leonxlnx/taste-skill`,
`nextlevelbuilder/ui-ux-pro-max-skill`, `vercel-labs/agent-skills`,
`cloudflare/security-audit-skill`.

## Notes

- The library is machine-local, not committed to any repo. Each repo only carries a short
  pointer in `AGENTS.md` / `CLAUDE.md`.
- Repo rules and repo skills still win. Global skills are a floor, not an override.
- `agent-stack.sh install` is network-bound and takes about a minute. `curate` is
  local-only and instant.
