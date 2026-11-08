# Codex project configuration

Root AGENTS.md is the entry point. Existing domain guidance remains in its original files. This file documents the compatibility layer, not application behavior.

## Rules

Codex does not automatically activate Cursor .mdc rules. Before work, read the always-on rules listed below. Read scoped rules when the task or files match their scope. Cursor model aliases and tool names are not Codex settings; use the current Codex model and available tools. Superpowers and delegation remain opt-in.

| Source rule | When to read |
|---|---|
| `.cursor/rules/accessibility.mdc` | - 'ui/src/**/*.tsx |
| `.cursor/rules/admin-auth.mdc` | - 'supabase/functions/_shared/auth.ts |
| `.cursor/rules/agent-reporting.mdc` | Always |
| `.cursor/rules/ai-assistant-parity.mdc` | - ui/src/features/dashboard/**/* |
| `.cursor/rules/ai-usage.mdc` | Always |
| `.cursor/rules/architecture.mdc` | - 'ui/src/**/* |
| `.cursor/rules/audit-logging.mdc` | Always |
| `.cursor/rules/booking-workflow.mdc` | - 'supabase/functions/_shared/statusMachine.ts |
| `.cursor/rules/branch-lifecycle.mdc` | Always |
| `.cursor/rules/competitive-ux-research.mdc` | - 'ui/src/features/**/*.tsx |
| `.cursor/rules/components.mdc` | - 'ui/src/**/*.tsx |
| `.cursor/rules/documentation-maintenance.mdc` | Always |
| `.cursor/rules/forms.mdc` | - 'ui/src/**/*Form*.tsx |
| `.cursor/rules/git-commits.mdc` | Always |
| `.cursor/rules/github-issues.mdc` | Task-specific; read when relevant |
| `.cursor/rules/human-copy.mdc` | Always |
| `.cursor/rules/karpathy-guidelines.mdc` | Always |
| `.cursor/rules/markitdown-mcp.mdc` | Always |
| `.cursor/rules/mobile-native-ui.mdc` | Always |
| `.cursor/rules/mobile-responsive.mdc` | - 'ui/src/**/*.tsx |
| `.cursor/rules/naming-conventions.mdc` | - 'ui/src/**/* |
| `.cursor/rules/no-prod-deploy.mdc` | Always |
| `.cursor/rules/notifications.mdc` | - supabase/migrations/*notifications*.sql |
| `.cursor/rules/observability.mdc` | Always |
| `.cursor/rules/page-titles.mdc` | Always |
| `.cursor/rules/parking-workflow.mdc` | - 'supabase/functions/_shared/parkingStatusMachine.ts |
| `.cursor/rules/plan-mode.mdc` | Task-specific; read when relevant |
| `.cursor/rules/plans-and-permissions.mdc` | Always |
| `.cursor/rules/project-context.mdc` | Always |
| `.cursor/rules/property-dashboard-qa.mdc` | - ui/src/features/dashboard/property/** |
| `.cursor/rules/public-ui.mdc` | - 'ui/src/features/guest/marketing/**/* |
| `.cursor/rules/pwa.mdc` | - ui/src/pwa/** |
| `.cursor/rules/route-guides.mdc` | Always |
| `.cursor/rules/security.mdc` | - 'supabase/functions/**/*.ts |
| `.cursor/rules/self-review.mdc` | Task-specific; read when relevant |
| `.cursor/rules/sentry.mdc` | - ui/src/lib/sentry/** |
| `.cursor/rules/skeleton-loaders.mdc` | Always |
| `.cursor/rules/social-creative.mdc` | - 'marketing/social/** |
| `.cursor/rules/social-inbox.mdc` | - supabase/functions/**/meta-inbox-*/** |
| `.cursor/rules/state-management.mdc` | - 'ui/src/**/hooks/**/*.ts |
| `.cursor/rules/supabase-edge-functions.mdc` | supabase/functions/**/*.ts |
| `.cursor/rules/supabase-platform.mdc` | - 'supabase/migrations/**/*.sql |
| `.cursor/rules/superpowers-opt-in.mdc` | Always |
| `.cursor/rules/support-content.mdc` | Always |
| `.cursor/rules/tech-stack.mdc` | - 'ui/**/*.{ts,tsx} |
| `.cursor/rules/testing.mdc` | Always |
| `.cursor/rules/ui-minimal-copy.mdc` | Always |
| `.cursor/rules/unsaved-changes.mdc` | Always |
| `.cursor/rules/workflow-docs.mdc` | Task-specific; read when relevant |

## Skills and commands

Codex discovers the existing project skills through relative links under .agents/skills. Original folders and resources stay together so changes remain shared with Cursor/Claude. Do not move or copy only SKILL.md. Run `python3 .codex/sync.py` after adding or changing skills, commands or agent definitions.

Command adapters use `$source-command-<command>` and read the original command file; they do not automatically run on every task. See compatibility.json for exact names and sources. Native specialist definitions live in .codex/agents; use them only with explicit delegation requests.

## Hooks and connected tools

Existing command hooks are adapted to Codex event payloads. apply_patch file paths are extracted for migration guards and file reminders. Legacy ask decisions become a supported denial with the original reason because Codex does not support ask from PreToolUse yet. The adapter does not execute the proposed command. Review/trust project hooks in Codex before relying on them; this setup does not bypass trust. Shell commands that edit files remain subject to shell policy, not an absolute filesystem enforcement layer.

Existing .codex/config.toml MCP settings are preserved. Cursor MCP settings and editor extensions do not automatically become Codex integrations. Use connected Codex tools where available; per-server authentication and local service availability still apply. No production service or credentials are provisioned by this compatibility setup.

## Validation

Configuration validation checks skill metadata and links, original command references, TOML/JSON parsing and safe hook fixtures. It does not assert the application builds or that external MCP services are authenticated.

Skills available locally: 168. Command adapters: 26. Specialist definitions: 4.
