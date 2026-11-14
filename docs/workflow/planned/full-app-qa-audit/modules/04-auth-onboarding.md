---
title: 'QA packet 04: auth, onboarding, invites'
status: planned
stage: planned
kind: reference
tags: [qa, audit, auth, onboarding]
updated: 2026-11-13
---

# 04 Auth and onboarding

**Rows:** AUTH-01 to AUTH-09 · **Personas:** `anon`, `new-host`, `unverified`, `owner`, `guest`, invited members of each role, `stranger`, `super-admin` (as approver in a second context) · **Environments:** L. Google sign-in needs `local-google-setup.md` or is `blocked`. P: sign in as `prod-probe` only.

## References

Guides: `auth.md`, `sign-in.md`, `onboarding.md`, `accept-invite.md`, `org/selector.md`, `org/setup-guide.md`, `verify.md`. Rules: `admin-auth.mdc`. Architecture: `identity-verification.md`, `data-privacy-identity.md`. Manual guides: `auth-playwright.md`, `onboarding-playwright.md`, `identity-verification-manual.md`, `local-google-setup.md`. Skills: `supabase-auth`, `multi-tenancy`, `security-audit`. Specs: `ui/e2e/features/auth` (5), `onboarding` (1), `host-verification` (4). Scripts: `audit:auth-matrix`. `for-testing` plans: `onboarding-verification-simplify`, `host-verification-tiers`, `verification-scope-split`, `super-admin-step-up-otp`.

## Probe beyond the generic lenses

**Login and register, host and guest (AUTH-01 to 04)**

- Each method offered: email + password, OTP, magic link, Google. Wrong password, unknown email, unconfirmed email, expired or reused OTP, OTP resend throttle, captcha.
- Error messages do not reveal whether an account exists.
- `next` / return URL: preserved through login, rejected when it points off-site (open redirect).
- The shared auth side panel on public pages vs the full pages: same behavior.
- Already signed in as the other identity type: what happens, and is it understandable.
- Password reset end to end, including the email link on a different device.
- Sign-out everywhere: session cleared, cached queries cleared (no previous user's data flashes), PWA cache.

**Onboarding (AUTH-05)**

- Every step in the guide's Steps section: validation, save path, resume after closing the browser, back, skipping optional steps.
- Identity and enhanced verification captures; document uploads; what the host sees while pending.
- Org and first property creation: slug generation, slug collisions, reserved words, special characters, very long names.
- Outcomes with `super-admin` in a second context: approve, reject (lands on `/verification-rejected` with reasons and a resubmit path), request changes (C19, C31).
- Post-registration Setup Guide overlay (ORG-15) appears once, tracks completion truthfully, reward step.
- A host with zero orgs, one org, several orgs through `/org` selector (AUTH-08); last-used org memory.

**Accept invite (AUTH-07)**

- Org, property and parking invites; new user vs existing user; signed in as a different email; expired, revoked, already accepted, tampered token; seat limit reached at accept time (C15).

**Guards (AUTH-09)**: one table-driven record.

- For every shell (public, guest account, org, property, parking, admin): signed-out, guest identity, host without membership, host with membership but no view leaf, `stranger`, suspended org, archived property, super-admin.
- Expected result per cell: redirect target, no-access screen, or 404-like. No flash of protected content, no protected data in the network panel before the redirect.
- Step-up OTP where required (payment settings, super-admin): prompt, wrong code, expiry, cannot be skipped by calling the function directly.
- Legacy admin allow list (`ADMIN_ALLOWED_EMAILS`, `verifyAdminJwt`): which functions still depend on it, and whether a normal org owner is wrongly blocked or wrongly allowed.

## Hidden surfaces

Supabase Auth config (providers, redirect URLs, rate limits, captcha), `accept-*-invite` functions, verification functions and `identity-captures-purge-cron`, org and property creation functions, verification emails, `org-verification-rejected.html`.

## Connections and journeys

C15, C19, C31. J05, J07, J30.

## Known risks

- `verify_jwt=false` on functions means the function body is the only boundary. Every admin function must call its auth check first; `check:auth-matrix` output is the lead list.
- RLS is not the access-control layer. Probe direct `rest/v1` table access with the anon key and with a `stranger` JWT for the tables behind auth-sensitive pages.
