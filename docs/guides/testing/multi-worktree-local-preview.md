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

In Orca: **Settings → Repository → Command source** should use **orca.yaml**
(not Local only), so new worktrees pick up these hooks after `orca.yaml` is on
the start-from branch.

## Auth and Maps on non-5173 ports

Local GoTrue `additional_redirect_urls` includes `5173`–`5199` for
`127.0.0.1` and `localhost`. After pulling that `config.toml` change, restart
the shared stack once so Auth reloads.

Google Cloud (one-time operator edit):

1. OAuth client → Authorized JavaScript origins: add
   `http://127.0.0.1:5173` through `:5199` (and `localhost` mirrors) or the
   ports you actually use.
2. Maps API key website restriction: allow
   `http://127.0.0.1:5173/*` … `5199/*` (and `localhost`).

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
