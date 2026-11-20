---
title: 'PR-013 and PR-015: prompt-injection tests and shared-device sign-out (2026-11-20)'
status: active
stage: in-progress
kind: reference
readiness: verified
launch_gate: B
launch_blocker: true
last_verified: 'local 2026-11-20'
---

# Prompt-injection coverage and shared-device sign-out

Both items were marked "exists, expand" and "code path exists, proof open". Expanding the
tests found a real sign-out leak and two inbox guard bypasses, so each item ships a fix and
a regression test, not only extra coverage.

## PR-013: prompt injection

### What the tests cover now

| Area                     | Test                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Untrusted fence breakout | `injection_red_team.jsonl` grew from 6 to 14 cases: nested opening tags, `</ untrusted_data >`, newline in the closing tag, HTML-entity encoded fences, repeated closing tags, a tool-call JSON payload, a null-byte split and a Cyrillic homoglyph tag. The existing loop runs each case through `wrapUntrusted` and `inlineUntrusted` and fails if any tag survives or a newline reaches an inline label |
| Inline label breakout    | `aiEvalsOffline.test.ts`: a file name containing `"` and instructions stays one JSON-encoded quoted value and cannot close its slot                                                                                                                                                                                                                                                                        |
| Inbox reply guard        | `inboxAiSafetyGuard_test.ts`: formatted account numbers (`0917.555.1234`, `(0917) 555-1234`, `+63 917 555 1234`) are blocked, a refusal phrase cannot whitelist a finance figure after it, and a refusal with no figure stays allowed                                                                                                                                                                      |
| Tool-arg hijack          | Existing `validateToolArgs` rejection stays, plus the red-team dataset tool-call case                                                                                                                                                                                                                                                                                                                      |

### Two real gaps found and fixed

1. **Formatted account numbers slipped past the guard.** `ACCOUNT_NUMBER_PATTERN` accepted only
   spaces and hyphens between digits, so a reply that grouped a GCash or bank number with dots
   or parentheses was not recognized as a stray account. The pattern now accepts `.`, `()`,
   spaces, hyphens and `+`, then normalizes to digits; 10+ digit runs still must be a configured
   account or appear in the grounded facts.
2. **A refusal phrase whitelisted a leak.** `assertSafeGuestReply` returned safe as soon as a
   sensitive inquiry met a refusal phrase, so "I can't share that, but our revenue was
   PHP 1,000,000" passed. A new `FINANCE_TERM_NEAR_FIGURE_PATTERN` rejects a finance term
   followed by a currency amount, a large number or a percentage, even when the draft also
   refuses.

## PR-015: shared-device sign-out

### The leak the proof found

`PwaQueryPersistence` set the viewer key to `anon` on `SIGNED_OUT` and immediately re-subscribed
the persister. The purge cleared the store, then the new subscription (plus a trailing write
from the old one) wrote the just-cleared cache back, including the signed-in guest's profile.
The e2e test caught `gfm-rq-anon` and `gfm-rq-user-…` entries with tenant data after sign-out.

### Fix

- On `SIGNED_OUT`, tear the persister down, clear the query client and purge offline state,
  then set the viewer key to `null` instead of `anon`.
- The persistence effect returns early for `null`, so nothing is re-subscribed after sign-out.
  Anonymous visitors no longer persist tenant-keyed queries at all; the allowlist is
  tenant/shell data, so there is nothing an anonymous viewer should keep offline.
- An in-flight write from the old subscription can no longer land after the purge because the
  subscriber is disposed before the purge and no new subscriber is created.

### Proof

`ui/e2e/features/account/sharedDeviceSignOut.spec.ts` (`@ci @critical`):

1. Signs in as a guest via the auth seam, seeds the PWA-owned stores (`gfm-api` Cache Storage,
   `gfm-query-cache` IndexedDB with a `tenant-secret` value, plus an unrelated `other-app`
   cache) and asserts the data is really there.
2. Logs out through the real `/account/settings` button.
3. Asserts the auth token is gone, every `gfm-*` / `workbox-*` cache is deleted, the persisted
   query store has no keys and no `tenant-secret`, and the unrelated `other-app` cache survives.

It reads through the connection it opened while seeding, because the app's own
`deleteDatabase` is blocked by an open idb connection (documented in `purgeOfflineState`), and
the store-level `clear()` is the removal that matters.

## Verification

| Run                                                                                | Result                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------ |
| `deno test` on `inboxAiSafetyGuard_test.ts` + `tests/evals/aiEvalsOffline.test.ts` | 56 passed                                  |
| `bun run test` (UI unit, node + dom)                                               | 6,525 passed / 6 skipped, 84 passed        |
| `bun run type-check` / `bun run lint`                                              | pass, 0 lint errors                        |
| `bunx playwright test --project=chromium-ci ui/e2e/features/account`               | 8 passed (includes the new sign-out proof) |
| `bun run test:e2e:pwa`                                                             | 12 passed                                  |
