#!/usr/bin/env python3
"""Normalize modal chrome padding to the canonical scale.

Canonical (see ui/src/components/ui/modal-chrome.ts):
  header / footer: px-4 sm:px-5, py-3
  body:            px-4 sm:px-5, py-4

Two modal families exist in the app:

  split  — sticky header / scrollable body / sticky footer. The chrome owns the
           padding, so the dialog box itself must not add any (`p-0`).
  card   — a padded dialog (`p-4 sm:p-5` from `DialogContent`) with the content
           inline. Its header / footer must not add padding of their own.

This script rewrites the padding utilities of the chrome elements per family
and reports split modals that are missing `p-0` (they currently render with the
dialog padding *plus* their own chrome padding — the "big padding" look).

Usage: python3 scripts/dev/normalize-modal-chrome.py [--dry-run]
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "ui" / "src"

PX_MAP = {"px-2": "px-4", "px-3": "px-4", "px-4": "px-4", "px-5": "px-4", "px-6": "px-4"}
SM_PX_MAP = {f"sm:{k}": "sm:px-5" for k in PX_MAP}
CHROME_PY_MAP = {
    "py-2": "py-3",
    "py-2.5": "py-3",
    "py-3": "py-3",
    "py-3.5": "py-3",
    "py-4": "py-3",
    "py-5": "py-3",
    "py-6": "py-3",
}
BODY_PY_MAP = {
    "py-2": "py-4",
    "py-2.5": "py-4",
    "py-3": "py-4",
    "py-3.5": "py-4",
    "py-4": "py-4",
    "py-5": "py-4",
    "py-6": "py-4",
}
SM_PY_MAP = {f"sm:{k}": "sm:py-3" for k in CHROME_PY_MAP}
SM_BODY_PY_MAP = {f"sm:{k}": "sm:py-4" for k in BODY_PY_MAP}
PB_MAP = {"pb-3.5": "pb-3"}

CONTENT_TAG = re.compile(r"<ResponsiveModalContent\b((?:[^>])*?)>", re.S)
HEADER_STR = re.compile(
    r"(<ResponsiveModalHeader\b[^>]*?className=\")([^\"]*)(\")", re.S
)
HEADER_CN = re.compile(
    r"(<ResponsiveModalHeader\b[^>]*?className=\{cn\(\s*')([^']*)(')", re.S
)
FOOTER_STR = re.compile(
    r"(<ResponsiveModalFooter\b[^>]*?className=\")([^\"]*)(\")", re.S
)
FOOTER_CN = re.compile(
    r"(<ResponsiveModalFooter\b[^>]*?className=\{cn\(\s*')([^']*)(')", re.S
)
BODY_TAG = re.compile(r"(<(?:div|ul|section)\b[^>]*?className=\")([^\"]*)(\")", re.S)

BODY_SIGNATURE = ("min-h-0", "flex-1", "overflow-y-auto")
PADDING_TOKEN = re.compile(r"^(?:sm:|md:|lg:|max-lg:|max-sm:)?p[xy]-\d+(?:\.\d+)?$")


def rewrite(cls, maps):
    out = []
    for token in cls.split():
        replacement = None
        for table in maps:
            if token in table:
                replacement = table[token]
                break
        out.append(replacement if replacement else token)
    return " ".join(t for t in out if t)


def strip_padding(cls, kind):
    """Card modals inherit the dialog padding, so their chrome adds none.

    A bordered header / footer still needs a little room so the rule does not
    touch the title (or the action row) — keep 8px on the rule side.
    """
    tokens = [t for t in cls.split() if not PADDING_TOKEN.match(t)]
    if "border-b" in tokens and kind == "header":
        tokens.append("pb-2")
    if "border-t" in tokens and kind == "footer":
        tokens.append("pt-2")
    return " ".join(tokens)


def normalize_chrome(cls):
    cls = cls.replace("max-lg:px-4", "px-4 sm:px-5")
    cls = cls.replace("sm:px-0", "sm:px-5")
    return rewrite(cls, [PX_MAP, SM_PX_MAP, CHROME_PY_MAP, SM_PY_MAP, PB_MAP])


def normalize_body(cls):
    if not all(sig in cls.split() for sig in BODY_SIGNATURE):
        return cls
    cls = cls.replace("max-lg:px-4", "px-4 sm:px-5")
    cls = cls.replace("sm:px-0", "sm:px-5")
    return rewrite(cls, [PX_MAP, SM_PX_MAP, BODY_PY_MAP, SM_BODY_PY_MAP])


def patch_block(text, start, end, split):
    block = text[start:end]

    if split:
        block = HEADER_STR.sub(
            lambda m: m.group(1) + normalize_chrome(m.group(2)) + m.group(3), block
        )
        block = HEADER_CN.sub(
            lambda m: m.group(1) + normalize_chrome(m.group(2)) + m.group(3), block
        )
        block = FOOTER_STR.sub(
            lambda m: m.group(1) + normalize_chrome(m.group(2)) + m.group(3), block
        )
        block = FOOTER_CN.sub(
            lambda m: m.group(1) + normalize_chrome(m.group(2)) + m.group(3), block
        )
        block = BODY_TAG.sub(
            lambda m: m.group(1) + normalize_body(m.group(2)) + m.group(3), block
        )
    else:
        block = HEADER_STR.sub(
            lambda m: m.group(1) + strip_padding(m.group(2), "header") + m.group(3), block
        )
        block = HEADER_CN.sub(
            lambda m: m.group(1) + strip_padding(m.group(2), "header") + m.group(3), block
        )
        block = FOOTER_STR.sub(
            lambda m: m.group(1) + strip_padding(m.group(2), "footer") + m.group(3), block
        )
        block = FOOTER_CN.sub(
            lambda m: m.group(1) + strip_padding(m.group(2), "footer") + m.group(3), block
        )

    return text[:start] + block + text[end:]


def main():
    dry_run = "--dry-run" in sys.argv
    changed = []
    missing_p0 = []

    for path in sorted(ROOT.rglob("*.tsx")):
        text = path.read_text(encoding="utf-8")
        original = text

        contents = list(CONTENT_TAG.finditer(text))
        for index, match in enumerate(contents):
            attrs = match.group(1)
            split = 'sheetLayout="split"' in attrs
            if split and "p-0" not in attrs:
                missing_p0.append(
                    f"{path.relative_to(ROOT.parent)}:{text[: match.start()].count(chr(10)) + 1}"
                )
            end = contents[index + 1].start() if index + 1 < len(contents) else len(text)
            text = patch_block(text, match.start(), end, split)

        if text != original:
            changed.append(path)
            if not dry_run:
                path.write_text(text, encoding="utf-8")

    print(f"{len(changed)} files changed{' (dry run)' if dry_run else ''}")
    for p in changed:
        print(" ", p.relative_to(ROOT.parent))
    if missing_p0:
        print("\nsplit modals without p-0 (double padding on desktop):")
        for item in missing_p0:
            print(" ", item)


if __name__ == "__main__":
    main()
