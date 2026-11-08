#!/usr/bin/env python3
"""Adapt existing repository hooks to Codex payloads without executing tool commands."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def main():
    source = (ROOT / sys.argv[1]).resolve()
    source.relative_to(ROOT)
    event = json.load(sys.stdin)
    tool = event.get('tool_input') or {}
    if not isinstance(tool, dict):
        tool = {'command': tool} if isinstance(tool, str) else {}
    command = tool.get('command', tool.get('cmd', event.get('command', '')))
    paths = []
    if event.get('tool_name') == 'apply_patch':
        for line in str(command).splitlines():
            match = re.match(r'^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$', line)
            if match:
                paths.append(match.group(1))
    if not paths:
        paths = [tool.get('file_path', event.get('file_path', ''))]
    context = []
    env = dict(os.environ, CLAUDE_PROJECT_DIR=str(ROOT), CURSOR_PROJECT_DIR=str(ROOT))
    for path in dict.fromkeys(paths):
        absolute = str((Path(event.get('cwd', str(ROOT))) / path).resolve()) if path else ''
        payload = dict(event, command=command, file_path=absolute)
        payload['tool_input'] = dict(tool, command=command, file_path=absolute)
        result = subprocess.run(['bash', str(source)], input=json.dumps(payload), text=True,
                                capture_output=True, cwd=ROOT, env=env, timeout=20)
        if result.returncode:
            print(result.stderr.strip() or 'Repository hook failed; inspect it before retrying.', file=sys.stderr)
            return 2
        try:
            response = json.loads(result.stdout or '{}')
        except json.JSONDecodeError:
            response = {'systemMessage': result.stdout.strip()}
        specific = response.get('hookSpecificOutput') or {}
        decision = specific.get('permissionDecision', response.get('permission'))
        reason = (specific.get('permissionDecisionReason') or response.get('agent_message')
                  or response.get('user_message') or response.get('reason') or 'Repository policy requires review.')
        if decision in ['ask', 'deny'] or response.get('decision') == 'block':
            # Codex does not currently support permissionDecision=ask: fail closed.
            print(json.dumps({'hookSpecificOutput': {'hookEventName': event.get('hook_event_name', 'PreToolUse'),
                  'permissionDecision': 'deny', 'permissionDecisionReason': reason}}))
            return 0
        message = specific.get('additionalContext') or response.get('systemMessage') or response.get('agent_message')
        if message:
            context.append(message)
    print(json.dumps({'systemMessage': '\n'.join(context)}) if context else '{}')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print('Repository hook adapter error: ' + str(error), file=sys.stderr)
        sys.exit(2)
