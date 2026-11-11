#!/usr/bin/env bash
# Verify the machine-wide agent skill stack is healthy and every provider agrees.
# Read-only. Safe to run in CI or before starting work.
#
# Usage: bash scripts/dev/check-agent-stack.sh

set -euo pipefail

LIB="$HOME/.agents/skill-library"
CATALOG="$HOME/.agents/skill-catalog"
MANIFEST="$CATALOG/manifest.json"
MANAGER="$HOME/.agents/bin/agent-stack.sh"

PROVIDERS=(
  "$HOME/.agents/skills"
  "$HOME/.claude/skills"
  "$HOME/.cursor/skills"
  "$HOME/.config/opencode/skills"
)

fail=0
pass() { printf '  \033[32mpass\033[0m  %s\n' "$*"; }
bad() {
  printf '  \033[31mfail\033[0m  %s\n' "$*"
  fail=1
}
skip() { printf '  \033[2mskip\033[0m  %s\n' "$*"; }

echo "Agent skill stack"
echo

# 1. manager + manifest present
[[ -x "$MANAGER" ]] && pass "manager executable: ${MANAGER/#$HOME/~}" || bad "manager missing: $MANAGER"
[[ -f "$MANIFEST" ]] && pass "manifest present" || bad "manifest missing: $MANIFEST"

if [[ "$fail" -eq 0 ]]; then
  # 2. library size
  lib_count=$(find "$LIB" -maxdepth 2 -name SKILL.md 2>/dev/null | wc -l | tr -d ' ')
  [[ "$lib_count" -ge 100 ]] && pass "library has $lib_count skills" || bad "library only has $lib_count skills"

  # 3. every visible skill exists everywhere
  visible=$(jq -r '.skills[] | select(.visible == true) | .name' "$MANIFEST" | sort)
  vis_count=$(grep -c . <<<"$visible")
  drift=0
  for p in "${PROVIDERS[@]}"; do
    [[ -d "$p" ]] || {
      bad "provider dir missing: ${p/#$HOME/~}"
      continue
    }
    while IFS= read -r name; do
      [[ -n "$name" ]] || continue
      if [[ ! -f "$p/$name/SKILL.md" ]]; then
        bad "${p/#$HOME/~}/$name does not resolve"
        drift=1
      fi
    done <<<"$visible"
  done
  [[ "$drift" -eq 0 ]] && pass "all 4 providers resolve the same $vis_count visible skills"

  # 4. token budget
  chars=0
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    f="$LIB/$name/SKILL.md"
    [[ -f "$f" ]] || continue
    c=$(python3 - "$f" <<'PY'
import sys, re
t = open(sys.argv[1], encoding="utf-8", errors="replace").read()
m = re.match(r"^---\n(.*?)\n---", t, re.S)
if not m:
    print(0); sys.exit()
fm = m.group(1)
total = 0
for key in ("name", "description"):
    hit = re.search(rf"^{key}:\s*(.*)$", fm, re.M)
    if hit:
        total += len(hit.group(1))
print(total)
PY
)
    chars=$((chars + c))
  done <<<"$visible"

  tokens=$((chars / 4))
  if [[ "$tokens" -le 1200 ]]; then
    pass "visible set costs ~$tokens tokens per request (budget 1200)"
  else
    bad "visible set costs ~$tokens tokens per request (budget 1200)"
  fi

  # 5. router exists and covers the library
  if [[ -f "$LIB/agent-skills-index/SKILL.md" ]]; then
    indexed=$(grep -o '`[a-z0-9-]*`' "$LIB/agent-skills-index/SKILL.md" | tr -d '`' | sort -u | wc -l | tr -d ' ')
    pass "router indexes $indexed skill names"
  else
    bad "router agent-skills-index missing"
  fi

  # 6. no dangling symlinks in any provider face
  dangling=0
  for p in "${PROVIDERS[@]}"; do
    [[ -d "$p" ]] || continue
    while IFS= read -r link; do
      [[ -L "$link" && ! -e "$link" ]] && {
        bad "dangling symlink: ${link/#$HOME/~}"
        dangling=1
      }
    done < <(find "$p" -maxdepth 1 -type l 2>/dev/null)
  done
  [[ "$dangling" -eq 0 ]] && pass "no dangling symlinks"

  # 7. agent-owned bundles must survive curate (regression guard)
  missing_owned=0
  for owned in synced .kits canvas automate visualize goal shell share loop; do
    if [[ "$owned" == .kits ]]; then
      [[ -d "$HOME/.agents/skills/.kits" ]] || {
        bad "agent-owned .kits was removed from ~/.agents/skills"
        missing_owned=1
      }
    elif [[ ! -e "$HOME/.agents/skills/$owned" ]]; then
      bad "agent-owned skill removed from ~/.agents/skills: $owned"
      missing_owned=1
    fi
  done
  [[ "$missing_owned" -eq 0 ]] && pass "agent-owned skills intact (curate is scoped to the manifest)"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "agent skill stack OK"
else
  echo "agent skill stack has failures — run ~/.agents/bin/agent-stack.sh install"
  exit 1
fi
