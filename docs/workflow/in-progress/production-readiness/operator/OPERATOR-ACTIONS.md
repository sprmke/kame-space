---
title: 'Operator actions for launch'
status: active
updated: 2026-11-20
stage: in-progress
kind: reference
readiness: operator-blocked
launch_gate: G
---

# Operator actions

Merged from P0/D/V, GitHub env, and checklist 4.4. How to verify each row.

Parent detail: [`cost-abuse-security-pending-from-user.md`](./cost-abuse-security-pending-from-user.md).

| ID                 | Action                                                                                                     | Verify                                                                                                                                                  | Status 2026-10-19                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| P0-1               | Turnstile on hosted UI + `CAPTCHA_MODE=enforce`                                                            | `bun scripts/dev/verify-captcha-enforcement.ts --url https://<ref>.supabase.co/functions/v1` returns `enforcing`. The live bundle carries the site key. | ✅ 2026-11-20: production enforcing (`evidence/pr-012-001-002-006-2026-11-20.md`)                                        |
| P0-2               | Supabase Auth Attack Protection captcha                                                                    | Same script with `--anon-key <public anon key>` probes Auth. Dashboard → Auth → Attack Protection                                                       | ✅ 2026-11-20: production answers `captcha_failed` without a token                                                       |
| P0-3               | GCP billing cap + paid Gemini/Groq                                                                         | Steps below. Edge `GEMINI_API_KEYS` / `GROQ_API_KEY` exist (rotation, not necessarily paid)                                                             | ⛔ operator: paid key + GCP budget with a billing-disable action. The in-app ceiling is already on (default 150 USD/day) |
| P0-4               | Maps key HTTP referrer lock                                                                                | Google Cloud credentials page                                                                                                                           | ⛔                                                                                                                       |
| P0-5               | Spend alerts: Resend, PayMongo, Meta, Supabase                                                             | Each dashboard                                                                                                                                          | ⛔                                                                                                                       |
| P0-6               | Vault `*_CRON_SECRET` matches Edge                                                                         | 25 Vault secrets ↔ edge secrets, all paired in code ([`prod-env-matrix`](../environments/prod-env-matrix.md)). Set both per env                         | ⛔ partial                                                                                                               |
| P0-7               | Branch protection `quality`                                                                                | `gh api …/branches/{develop,main}/protection`                                                                                                           | ✅                                                                                                                       |
| PR-025             | GitHub env `development`: `DEV_DB_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_PASSWORD`, `SMOKE_PROPERTY_SLUG` | `gh api …/environments/development/secrets`                                                                                                             | 🔴 missing                                                                                                               |
| V-1                | Hosted-dev deploy current `develop`                                                                        | After merge of #145; functions deploy in flight from `3e269a98`                                                                                         | 🟡                                                                                                                       |
| V-2                | Abuse + CORS scripts                                                                                       | CORS on `get-health` **OK** 2026-10-19. Abuse scripts after full function deploy                                                                        | 🟡                                                                                                                       |
| V-3                | Captcha pass/fail keys                                                                                     | After P0-1                                                                                                                                              | ⛔                                                                                                                       |
| V-4                | In-house pentest §6.2                                                                                      | [`pentest-log.md`](../security/pentest-log.md)                                                                                                          | 🟡                                                                                                                       |
| V-5                | Guest token enforce                                                                                        | `GUEST_BOOKING_ACCESS_ENFORCE` **is** set on Edge. Walk old vs new booking links                                                                        | 🟡                                                                                                                       |
| PostHog            | Two projects + Vercel source maps                                                                          | Edge `POSTHOG_API_KEY` set. Prod/nonprod project split unverified                                                                                       | ⛔                                                                                                                       |
| PayMongo sandbox   | Test keys + webhook on dev                                                                                 | `PAYMONGO_SECRET_KEY` + `PAYMONGO_WEBHOOK_SECRET` names present. Run checkout                                                                           | ⛔ E2E                                                                                                                   |
| VAPID / push       | Already on Edge                                                                                            | Real-device QA                                                                                                                                          | 🟡                                                                                                                       |
| Resend DNS         | SPF/DKIM/DMARC                                                                                             | checklist 32                                                                                                                                            | ⛔                                                                                                                       |
| Auth redirect URLs | Supabase Auth allowlist includes `dev.kamehomes.space`                                                     | Dashboard                                                                                                                                               | 🟡                                                                                                                       |

## P0-3 runbook: paid AI key and spend caps

What the code already does, so the dollar figure below is a second line of defence and not the only one:

- **Platform ceiling.** `assertPlatformSpendCeiling` refuses every AI call once today's estimated platform spend reaches `AI_PLATFORM_DAILY_COST_USD_CAP` (default **150 USD**, `0` disables it). Since 2026-11-20 it runs before the per-org quota switch, so turning `enforce_quotas` off no longer lifts it. A failed spend read refuses the call.
- **Voice.** `voice-receptionist-start` checks the org and property quota and refuses before it mints a Gemini Live token.
- The estimate comes from `ai_platform_usage_events`. It is not the Google invoice, so keep the Google-side cap.

Steps (all need your accounts; hosted secret writes also need `kamewave`):

1. **Paid Gemini key.** In Google AI Studio, create a key under a billing-enabled Google Cloud project and set it as `GEMINI_API_KEY` on the production Supabase project. Remove free-tier keys from `GEMINI_API_KEYS`; free-tier rotation is against the provider terms at scale.
2. **Paid Groq key** as `GROQ_API_KEY` (text-only fallback).
3. **Google Cloud budget.** Billing, Budgets & alerts, create a budget with alerts at 50, 90 and 100 percent. A budget only emails. For a real hard cap, connect the budget to a Pub/Sub topic and a small function that disables billing on the project at 100 percent.
4. **Pick the daily ceiling.** Set `AI_PLATFORM_DAILY_COST_USD_CAP` to the most you are willing to lose in one day. Leave it unset to keep 150.
5. **Verify.** Super admin, System health: the AI spend cap row is green and shows the value, and no row says the cap is disabled.
