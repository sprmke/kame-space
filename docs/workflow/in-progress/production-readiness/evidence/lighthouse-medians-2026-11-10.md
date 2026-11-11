---
title: 'Lighthouse 3x median — https://kamespace.com (2026-11-10)'
status: active
stage: in-progress
kind: evidence
readiness: verified
launch_gate: A
launch_blocker: false
last_verified: '2026-11-10'
---

# Lighthouse 3x median

Mobile emulation, simulated throttling, 3 runs per route, median reported.
Command: `BASE_URL=https://kamespace.com node scripts/performance/lighthouse-medians.mjs`.

| Route | Perf | A11y | BP | SEO | LCP | TBT | CLS | n |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | 63 | 100 | 100 | 100 | 8.0s | 47ms | 0 | 3 |
| /properties | 61 | 100 | 100 | 100 | 8.8s | 95ms | 0 | 3 |
| /parkings | 62 | 100 | 100 | 100 | 8.4s | 61ms | 0 | 3 |
| /developments | 62 | 100 | 100 | 100 | 9.8s | 59ms | 0 | 3 |
| /search | 59 | 100 | 100 | 69 | 8.8s | 68ms | 0.058 | 3 |
| /for-hosts | 46 | 100 | 100 | 100 | 8.2s | 668ms | 0 | 3 |
| /for-hosts/pricing | 62 | 100 | 100 | 100 | 6.8s | 103ms | 0 | 3 |
| /properties/monaco-2604 | 59 | 100 | 96 | 100 | 11.1s | 86ms | 0 | 3 |
| /properties/monaco-2604/form | 55 | 100 | 96 | 63 | 7.5s | 218ms | 0.079 | 3 |
