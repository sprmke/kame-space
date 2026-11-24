---
title: 'ASVS 5.0 L2 (selected)'
status: active
updated: 2026-11-24
launch_gate: B
readiness: unverified
---

# ASVS 5.0 Level 2 (selected controls)

Not a full certification. Controls that map to this stack:

| Area               | Control                                      | Status                                                                                                                     |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| V2 Auth            | MFA / step-up on destructive super-admin     | 🟡 QA #7                                                                                                                   |
| V3 Session         | Sign-out clears caches                       | ✅ PR-015 (e2e)                                                                                                            |
| V4 Access          | Server-side permission leaves                | ✅ catalogs + `resolveScoped*Access`; auth matrix fails on any tenant function with no scope check                         |
| V5 Validation      | Server Zod on writes + bounded bodies        | ✅ 2 MB default JSON cap in `readJsonBody` (413), raw-body write guard in CI; per-handler strict schemas tracked as PR-018 |
| V7 Error           | No stack/secrets in JSON                     | ✅ `handleEdgeError` generic 5xx; `scrubText` redacts `bot<token>`, `Bearer`, token query params from Sentry + console     |
| V8 Data protection | PII buckets private; signed URLs             | 🟡 PR-016 (tenant paths verified); signed-URL TTL policy PR-017                                                            |
| V9 Communication   | TLS; HSTS at edge                            | ✅ `verify:deployed-preview` + `check-vercel-headers.sh`                                                                   |
| V10 Malicious      | MIME sniff uploads                           | ✅ every byte-writer sniffs (`check-storage-upload-sniff.sh`)                                                              |
| V11 Business logic | Workflow orchestrator; payments server-price | ✅ `statusMachine` + overlap guard + server-computed amounts (PR-104)                                                      |
| V12 Files          | Storage policies + path tenant scope         | ✅ PR-016                                                                                                                  |
| V13 API            | Rate limits; inventory                       | 🟡 public limits enforced, authenticated enforcement operator-gated; 378-function inventory swept in CI                    |
| V14 Config         | Secrets not in git; `check-tracked-secrets`  | ✅ gitleaks + tracked-secret scan clean                                                                                    |
| V15 Code           | CI quality + static guards                   | ✅ `ci:quality` incl. SSRF guard, auth matrix, raw-body write guard                                                        |
