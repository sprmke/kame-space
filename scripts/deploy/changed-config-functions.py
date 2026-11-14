#!/usr/bin/env python3
"""Which `[functions.<name>]` blocks in `supabase/config.toml` differ between two revisions.

`config.toml` carries per-function deploy settings (`verify_jwt`, `static_files`). The CD workflow
narrows a function deploy to the directories that changed, so without this a pure config edit
deploys nothing and the setting is silently never applied. That is not hypothetical: on 2026-11 a
`static_files` fix for the guest crons shipped, deployed green, and changed nothing.

Comparing whole blocks is deliberate. A unified diff of the usual fix — adding a line *inside* an
existing block — never mentions the block header, so header matching finds nothing.

Usage:
    changed-config-functions.py <old.toml> <new.toml>

Prints the changed function names, space separated, sorted. Prints nothing when no block changed.
"""

from __future__ import annotations

import re
import sys

HEADER = re.compile(r'^\[functions\.([a-z0-9-]+)\]\s*$')


def parse_blocks(path: str) -> dict[str, str]:
    """Map `[functions.<name>]` to its body. Any other table ends a block."""
    try:
        with open(path, encoding='utf-8') as handle:
            text = handle.read()
    except OSError:
        return {}

    blocks: dict[str, str] = {}
    current: str | None = None
    body: list[str] = []

    for line in text.splitlines():
        match = HEADER.match(line.strip())
        if match:
            if current is not None:
                blocks[current] = '\n'.join(body)
            current, body = match.group(1), []
        elif line.strip().startswith('['):
            if current is not None:
                blocks[current] = '\n'.join(body)
            current, body = None, []
        elif current is not None:
            body.append(line)

    if current is not None:
        blocks[current] = '\n'.join(body)
    return blocks


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__.strip().splitlines()[0], file=sys.stderr)
        return 2

    old, new = parse_blocks(argv[1]), parse_blocks(argv[2])
    changed = sorted(name for name in set(old) | set(new) if old.get(name, '') != new.get(name, ''))
    if changed:
        print(' '.join(changed))
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
