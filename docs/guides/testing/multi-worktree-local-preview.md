# Multi-worktree local preview

Preview each Orca (or git) worktree on its own Vite URL while sharing one local
Supabase Docker stack.

## Model

| Layer                                  | Shared or per worktree                              |
| -------------------------------------- | --------------------------------------------------- |
| Docker project `guest-form-management` | Shared (API `:54321`, DB `:54322`)                  |
| Edge `functions serve`                 | Shared                                              |
| Vite UI                                | One process per worktree, sticky port `5173`–`5199` |

Stopping Supabase from one worktree takes the API down for every other worktree.
Do not run `bun run stop:supabase` unless you mean to stop the whole machine
stack (unlock word `localstop`).

## Commands

```bash
bun run ui              # this worktree's Vite (sticky port)
bun run ui:port         # print sticky port only
./dev.sh                # if shared stack healthy → UI only; else cold-start stack + UI
./dev.sh --ui-only      # same as bun run ui
./dev.sh --ui-only --env dev   # Vite against hosted env file
```

`bun run dev:ui` stays the raw Vite entry (Playwright / CI pass `--host` /
`--port`). Use `bun run ui` for sticky worktree ports.

Sticky port is stored in gitignored `.local/vite-port`. Find the URL with:

```bash
echo "http://127.0.0.1:$(bun run ui:port)/"
orca ports --json       # Orca maps listeners to worktree paths
```

## Orca create / archive

Repo root [`orca.yaml`](../../../orca.yaml):

- `scripts.setup` → `bun install` + copy env files from `ORCA_ROOT_PATH` when missing
- `defaultTabs` → opens a **UI** tab that runs `bun run ui`
- `scripts.archive` → stops only this worktree's Vite (never Docker)

In Orca: open this project's **Worktree hooks → Advanced → Command source**
and set **orca.yaml only** (not Local only), so new worktrees pick up these
hooks. `orca.yaml` must exist on the branch the worktree starts from, and
Orca reads it from the project's primary checkout, so pull that branch there
before flipping the setting.

Until both are true, keep **Local only**. With `orca.yaml only` and no detected
file, Orca runs no setup at all: the saved local script is ignored and new
worktrees get no UI tab.

To make a new worktree open its preview in the Orca browser too, set the local
command source to **Run both** and save a local setup script that waits for the
port and calls `orca tab create` (see the existing-worktree command below for
the shape). `orca.yaml` cannot define browser tabs itself.

## Existing worktrees

Worktrees created before `orca.yaml` existed have no setup hook and no UI tab.
Run this from any checkout, pointing at the worktree:

```bash
bash scripts/dev/open-worktree-preview.sh ../cerith
# or from inside the worktree
bun run preview:worktree
```

It copies missing env files from the primary checkout, installs dependencies
when they are missing, starts (or reuses) the worktree's Vite server in a UI
terminal, waits for HTTP 200, and opens an Orca browser tab at the sticky port.
Pass `--split right` to open it in a split pane. It is idempotent: a running
server and an existing tab are reused.

Each Orca browser tab starts with no session. On `/for-hosts/login` or
`/for-guests/login`, local dev shows **Use local owner account** (host) or
**Use local guest account** (guest); it signs in with the seeded password
account instead of Google. See
[local seed data](./local-seed-data.md#signing-in).

## Auth and Maps on non-5173 ports

Local GoTrue `additional_redirect_urls` includes `5173`–`5199` for
`127.0.0.1` and `localhost`. After pulling that `config.toml` change, restart
the shared stack once so Auth reloads.

Google Cloud (one-time operator edit):

1. OAuth client → Authorized redirect URIs: add
   `http://127.0.0.1:54321/auth/v1/callback` (the `localhost` mirror only if
   the API uses it). Vite origins are not needed; GoTrue handles the redirect.
2. Maps API key website restriction: allow
   `http://127.0.0.1:5173/*` … `5199/*` (and `localhost`) for the ports you
   actually open.

Details: [`local-google-setup.md`](./local-google-setup.md).

## Clash rules

- Two worktrees never share a Vite port. The launcher bumps within `5173`–`5199`
  if the preferred sticky port is taken by another cwd.
- `archive` and `ui` only kill a listener whose process cwd is under this
  worktree.
- Cold-start `./dev.sh` reuses a healthy shared stack and does not recycle edge
  for a sibling that is already serving.

## Verify

1. Worktree A: `./dev.sh` (or `bun run ui` if stack is up) → note port A.
2. Worktree B: `bun run ui` → port B ≠ A; both call `:54321`.
3. `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:54321/functions/v1/get-health`
   → `200`.
4. Stop UI in A only; B still loads data.
