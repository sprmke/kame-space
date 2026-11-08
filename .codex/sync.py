#!/usr/bin/env python3
"""Keep existing Cursor/Claude project guidance discoverable by Codex. No network calls."""
import json
import os
from pathlib import Path
import re
import shlex

ROOT = Path(__file__).resolve().parent.parent


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_text() != text:
        path.write_text(text)


def frontmatter(text):
    if not text.startswith('---\n'):
        return '', text
    parts = text.split('---', 2)
    return parts[1], parts[2].lstrip('\n')


def scalar(header, field, default):
    match = re.search(r'^' + field + r':\s*(.+)$', header, re.M)
    if not match or match.group(1) in ['|', '>', '>-', '|-']:
        return default
    return match.group(1).strip().strip('"\'')


def main():
    skills = ROOT / '.agents/skills'
    skills.mkdir(parents=True, exist_ok=True)
    for entry in list(skills.iterdir()):
        if not entry.is_dir():
            continue
        filenames = {x.name for x in entry.iterdir()}
        if 'skill.md' in filenames and 'SKILL.md' not in filenames:
            # Preserve vendored filenames/resources; expose a small Codex entry point.
            name = entry.name + '-codex'
            write(skills / name / 'SKILL.md', '---\nname: ' + name + '\ndescription: ' + json.dumps('Use the existing ' + entry.name + ' workflow for codebase graphs and architecture relationships.') + '\n---\n\nRead [the original skill](../' + entry.name + '/skill.md) and follow it. Resolve its resources and relative references from the original skill directory; preserve project policies and available-tool limits.\n')
    sources = {}
    for folder in ['.agent/skills', '.cursor/skills', '.claude/skills']:
        directory = ROOT / folder
        if not directory.is_dir():
            continue
        for entry in sorted(directory.iterdir()):
            if (entry / 'SKILL.md').is_file():
                sources.setdefault(entry.name, entry.resolve())
    for name, source in sources.items():
        file = source / 'SKILL.md'
        text = file.read_text()
        header, body = frontmatter(text)
        if header:
            original_header = header
            # Cursor permits loose scalar descriptions that are invalid YAML (notably colon-space).
            for field in ['name', 'description']:
                pattern = r'^(' + field + r':)[ \t]*(.+)$'
                def quote_scalar(match):
                    value = match.group(2).strip()
                    if value.startswith(('"', "'", '|', '>')):
                        return match.group(0)
                    if ': ' not in value:
                        return match.group(0)
                    return match.group(1) + ' ' + json.dumps(value)
                header = re.sub(pattern, quote_scalar, header, flags=re.M)
            if header != original_header:
                write(file, '---' + header + '---\n\n' + body)
        if not header:
            paragraphs = [x.strip() for x in body.split('\n\n') if x.strip() and not x.lstrip().startswith('#')]
            description = re.sub(r'\s+', ' ', paragraphs[0] if paragraphs else 'Project-specific ' + name + ' workflow.')[:220]
            write(file, '---\nname: ' + name + '\ndescription: ' + json.dumps(description) + '\n---\n\n' + body)
        target = skills / name
        if not target.exists() and not target.is_symlink():
            target.symlink_to(os.path.relpath(source, target.parent), target_is_directory=True)
    commands = {}
    for folder in ['.cursor/commands', '.claude/commands']:
        for file in sorted((ROOT / folder).glob('*.md')):
            commands.setdefault(file.stem, file)
    for name, source in commands.items():
        skill_name = 'source-command-' + name
        target = skills / skill_name
        relative = os.path.relpath(source, target)
        write(target / 'SKILL.md', '---\nname: ' + skill_name + '\ndescription: ' + json.dumps('Run the existing project command ' + name + ' when the user requests it.') + '\n---\n\n# ' + name + '\n\nRead [' + str(source.relative_to(ROOT)) + '](' + relative + ') and follow that command using the user’s arguments. Resolve its relative references from the original command directory. Preserve project rules and authorization boundaries. Cursor/Claude-only tool names must map to actually available Codex tools; do not claim unavailable tools ran.\n')
    for folder in [skills]:
        for skill in folder.iterdir():
            content = (skill / 'SKILL.md').read_text() if (skill / 'SKILL.md').is_file() else ''
            explicit_only = bool(re.search(r'^disable-model-invocation:\s*true', frontmatter(content)[0], re.M))
            if 'superpowers' not in skill.name and not explicit_only:
                continue
            metadata = skill / 'agents/openai.yaml'
            old = metadata.read_text() if metadata.exists() else ''
            if re.search(r'allow_implicit_invocation:', old):
                old = re.sub(r'(allow_implicit_invocation:)\s*(true|false)', r'\1 false', old)
            elif re.search(r'^policy:', old, re.M):
                old = re.sub(r'^policy:', 'policy:\n  allow_implicit_invocation: false', old, count=1, flags=re.M)
            else:
                old += '\npolicy:\n  allow_implicit_invocation: false\n'
            write(metadata, old.lstrip('\n'))
    agents = {}
    for folder in ['.claude/agents', '.cursor/agents']:
        for file in sorted((ROOT / folder).glob('*.md')):
            agents.setdefault(file.stem, file)
    for name, source in agents.items():
        target = ROOT / '.codex/agents' / (name + '.toml')
        if target.exists():
            continue
        header, body = frontmatter(source.read_text())
        instructions = 'Read AGENTS.md and .codex/README.md before work. Only run this role when the user explicitly requests delegation. Inherit the parent model; Cursor/Claude model aliases do not apply.\n\n' + body
        write(target, 'name = ' + json.dumps(scalar(header, 'name', name)) + '\ndescription = ' + json.dumps(scalar(header, 'description', 'Project ' + name + ' specialist.')) + '\ndeveloper_instructions = ' + json.dumps(instructions) + '\n')
    hooks_file = ROOT / '.codex/hooks.json'
    hooks = json.loads(hooks_file.read_text()) if hooks_file.exists() else {'hooks': {}}
    if not hooks.get('hooks'):
        source = ROOT / '.claude/settings.json'
        if source.exists():
            hooks = {'hooks': json.loads(source.read_text()).get('hooks', {})}
        if not hooks.get('hooks') and (ROOT / '.cursor/hooks.json').exists():
            mapping = {'sessionStart': ('SessionStart', None), 'beforeShellExecution': ('PreToolUse', 'Bash'), 'afterFileEdit': ('PostToolUse', 'Edit|Write|apply_patch'), 'stop': ('Stop', None)}
            for key, groups in json.loads((ROOT / '.cursor/hooks.json').read_text()).get('hooks', {}).items():
                if key not in mapping:
                    continue
                event, matcher = mapping[key]
                hooks['hooks'].setdefault(event, []).append({'matcher': matcher or '', 'hooks': groups})
    # Merge missing canonical hooks without replacing existing plugin hooks.
    known = set()
    for event, groups in hooks.get('hooks', {}).items():
        for group in groups:
            for hook in group.get('hooks', []):
                match = re.search(r'/hooks/([A-Za-z0-9_.-]+\.sh)', hook.get('command', ''))
                if match: known.add((event, match.group(1)))
    canonical = ROOT / '.claude/settings.json'
    if canonical.exists():
        for event, groups in json.loads(canonical.read_text()).get('hooks', {}).items():
            for group in groups:
                for hook in group.get('hooks', []):
                    match = re.search(r'(\.claude/hooks/([A-Za-z0-9_.-]+\.sh))', hook.get('command', ''))
                    if match and (ROOT / match.group(1)).exists() and (event, match.group(2)) not in known:
                        hooks['hooks'].setdefault(event, []).append({'matcher': group.get('matcher', ''), 'hooks': [dict(hook)]})
                        known.add((event, match.group(2)))
    adapted = 0
    for event, groups in hooks.get('hooks', {}).items():
        for group in groups:
            if group.get('matcher') == 'Task':
                group['matcher'] = 'Task|Agent|spawn_agent'
            for hook in group.get('hooks', []):
                hook.setdefault('type', 'command')
                command = hook.get('command', '')
                if 'compat_hook.py' in command:
                    adapted += 1
                    continue
                match = re.search(r'(\.(?:claude|cursor|codex)/hooks/[A-Za-z0-9_.-]+\.sh)', command)
                if match and (ROOT / match.group(1)).is_file():
                    relative = match.group(1)
                    hook['command'] = 'python3 "$(git rev-parse --show-toplevel)/.codex/hooks/compat_hook.py" ' + shlex.quote(relative)
                    adapted += 1
    if hooks.get('hooks'):
        write(hooks_file, json.dumps(hooks, indent=2) + '\n')
    rules = []
    for file in sorted((ROOT / '.cursor/rules').glob('*.mdc')):
        header, body = frontmatter(file.read_text())
        always = bool(re.search(r'^alwaysApply:\s*true', header, re.M))
        rules.append({'path': str(file.relative_to(ROOT)), 'always': always, 'scope': scalar(header, 'globs', 'Task-specific; read when relevant')})
    names = sorted(x.name for x in skills.iterdir() if x.is_dir() and any(f.name == 'SKILL.md' for f in x.iterdir()))
    manifest = {'skills': names, 'commands': {k: str(v.relative_to(ROOT)) for k, v in commands.items()}, 'agents': [x.name for x in (ROOT / '.codex/agents').glob('*.toml')], 'rules': rules, 'adapted_hooks': adapted}
    write(ROOT / '.codex/compatibility.json', json.dumps(manifest, indent=2) + '\n')
    lines = ['# Codex project configuration', '', 'Root AGENTS.md is the entry point. Existing domain guidance remains in its original files. This file documents the compatibility layer, not application behavior.', '', '## Rules', '', 'Codex does not automatically activate Cursor .mdc rules. Before work, read the always-on rules listed below. Read scoped rules when the task or files match their scope. Cursor model aliases and tool names are not Codex settings; use the current Codex model and available tools. Superpowers and delegation remain opt-in.', '', '| Source rule | When to read |', '|---|---|']
    for rule in rules:
        lines.append('| `' + rule['path'] + '` | ' + ('Always' if rule['always'] else rule['scope'].replace('|', '\\|')) + ' |')
    lines += ['', '## Skills and commands', '', 'Codex discovers the existing project skills through relative links under .agents/skills. Original folders and resources stay together so changes remain shared with Cursor/Claude. Do not move or copy only SKILL.md. Run `python3 .codex/sync.py` after adding or changing skills, commands or agent definitions.', '', 'Command adapters use `$source-command-<command>` and read the original command file; they do not automatically run on every task. See compatibility.json for exact names and sources. Native specialist definitions live in .codex/agents; use them only with explicit delegation requests.', '', '## Hooks and connected tools', '', 'Existing command hooks are adapted to Codex event payloads. apply_patch file paths are extracted for migration guards and file reminders. Legacy ask decisions become a supported denial with the original reason because Codex does not support ask from PreToolUse yet. The adapter does not execute the proposed command. Review/trust project hooks in Codex before relying on them; this setup does not bypass trust. Shell commands that edit files remain subject to shell policy, not an absolute filesystem enforcement layer.', '', 'Existing .codex/config.toml MCP settings are preserved. Cursor MCP settings and editor extensions do not automatically become Codex integrations. Use connected Codex tools where available; per-server authentication and local service availability still apply. No production service or credentials are provisioned by this compatibility setup.', '', '## Validation', '', 'Configuration validation checks skill metadata and links, original command references, TOML/JSON parsing and safe hook fixtures. It does not assert the application builds or that external MCP services are authenticated.', '', 'Skills available locally: ' + str(len(names)) + '. Command adapters: ' + str(len(commands)) + '. Specialist definitions: ' + str(len(manifest['agents'])) + '.', '']
    write(ROOT / '.codex/README.md', '\n'.join(lines))
    print(ROOT.name + ': ' + str(len(names)) + ' skills; ' + str(len(commands)) + ' command adapters; ' + str(len(manifest['agents'])) + ' agent definitions; ' + str(adapted) + ' adapted hooks')


if __name__ == '__main__':
    main()
