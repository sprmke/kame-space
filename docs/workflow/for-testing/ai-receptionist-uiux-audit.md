---
title: 'AI receptionist UI/UX audit'
status: active
tags: [for-testing, ai-receptionist, ui, ux, a11y]
updated: 2026-11-23
stage: for-testing
kind: audit
---

# AI receptionist UI/UX audit

Module: guest AI voice receptionist (`/properties/:propertySlug/messages`), plus the two host
surfaces that control it (Org Settings → AI features, Super Admin → AI → Controls).

Method: full flow walkthrough in a real browser at **375, 768, 1024 and 1440 px**, light and dark,
driven by the repository's mocked provider harness (real React panel, real `useVoiceSession`, real
Gemini Live protocol client, real tool allowlist; fake WebSocket, microphone and audio graph). Plus
a code read of every component and edge path, and the existing unit/E2E suites.

Visual record: [`assets/ai-receptionist-audit/index.html`](./assets/ai-receptionist-audit/index.html)
(open in a browser). The slow-motion journey is
[`walkthrough-slowmo.mp4`](./assets/ai-receptionist-audit/walkthrough-slowmo.mp4).

**Decision board:**
[`assets/ai-receptionist-audit/recommendations.html`](./assets/ai-receptionist-audit/recommendations.html).
One card per item, with an annotated screenshot, what I would change, effort, risk, and a
do/later/skip call. Use it to pick codes (A1, B2, ...) before any of this is implemented.

Reproduce any screenshot:

```bash
# fast screenshots, all states and breakpoints
bunx playwright test ui/e2e/features/guest-chat/aiReceptionistWalkthrough.spec.ts --project=chromium

# slow-motion video (headed, 500 ms per action)
PLAYWRIGHT_RECORD_VIDEO=1 PLAYWRIGHT_SLOW_MO=500 \
  bunx playwright test ui/e2e/features/guest-chat/aiReceptionistWalkthrough.spec.ts \
  --project=chromium -g "guest calls the receptionist"
```

Screenshots land in `test-results/ai-receptionist-audit/` (`AI_RECEPTIONIST_SHOTS` overrides).
Behavioural coverage stays in `voiceReceptionistConsent.spec.ts` (smoke lane, 7 paths).

---

## Verdict

The core conversation is solid: an explicit consent gate, streaming captions, a legible five-state
booth, mute, countdown, end, host handoff, safe server-authored action cards, reconnect, and text
fallback on every failure. The problems are around the call, not inside it.

| Dimension       | Score     | Note                                                                                 |
| --------------- | --------- | ------------------------------------------------------------------------------------ |
| Task clarity    | 4/5       | Consent → start → speak is obvious. The countdown and cap are not explained.         |
| Discoverability | 2/5       | The flagship AI feature hides in a ⋮ menu, with no composer or empty-state entry.    |
| Feedback        | 4/5       | States, ring, captions and status copy are strong. Desktop composition feels empty.  |
| Error recovery  | 3/5       | Retry and Message host are present; the header mislabels mic failures as connection. |
| Accessibility   | 2/5 → 4/5 | Captions were silent to screen readers and amber text failed contrast. Both fixed.   |
| Responsive      | 3/5       | No overflow at any width. Phone keeps global chrome during a call.                   |
| Consistency     | 3/5       | Three names for one assistant; two different save patterns in one admin card.        |
| Trust           | 4/5       | Technical consent copy; no "AI can make mistakes" inside the call.                   |

---

## Fixed in this pass

1. **Blank avatar whenever WebGL is unavailable** (`ReceptionistAvatar.tsx`).
   The 3D Kame rig is the only avatar. When `three.js` cannot create a GL context it throws
   `Cannot read properties of null (reading 'precision')`, the error boundary renders a plain
   `bg-primary/15` disc, and the feature's hero surface looks broken. This reproduces in the
   Playwright Chromium build, in screenshot tools, and on locked-down devices. The booth and the
   lazy-load fallback now use the shipped `receptionist-turtle-idle.webp` poster instead.
2. **Live captions were not announced** (`VoiceSessionPanel.tsx`). Only the status label was a live
   region, so screen-reader guests heard "Listening"/"Thinking" but never the answer. Each completed
   receptionist reply is now announced once through a visually hidden polite region.
3. **Amber and red microcopy failed WCAG AA** (`VoiceSessionPanel.tsx`). `--warning` (43 96% 56%) is
   about 1.8:1 on white and `--destructive` (0 84% 60%) about 3.8:1, used for 11 px status labels
   and error text. The panel now uses `text-amber-700 dark:text-amber-300` and
   `text-red-700 dark:text-red-300`. The platform tokens still need a text-safe variant (see P2).
4. **A hang-up icon closed the panel before any call** (`VoiceSessionPanel.tsx`). The pre-call close
   control is now an X, matching "close panel", while the footer keeps the red PhoneOff for "end
   call".
5. **Countdown had no accessible name**. The visible `8:59` is now labelled "8:59 remaining" for
   assistive tech.

Tests added: `aiReceptionistWalkthrough.spec.ts` (`@demo`, 21 screenshots per run, breakpoints,
dark, failure states, host controls) and a shared harness
(`guest-chat/shared/voiceReceptionistHarness.ts`) used by both voice specs.

---

## P1 — fix before promoting the feature

| #   | Finding                                                                                                                                                                                                                                                              | Evidence                                            | Recommendation                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | **The feature is buried.** Voice lives only in the chat ⋮ menu as "Talk to receptionist". The empty thread shows five text starters and the composer shows no mic or call affordance, so a guest who never opens the menu never learns it exists.                    | `01-entry-chat-menu-1440.png`                       | Add a persistent mic/call button in the messages header (or next to the composer) and one "Talk to Kame" starter card. |
| 2   | **"Delete captions" is permanent and unconfirmed.** A single tap on a secondary button erases the transcript; there is no undo.                                                                                                                                      | `10-call-ended-1440.png`                            | Confirm with the shared `AlertDialog` ("Delete captions permanently?") or offer undo.                                  |
| 3   | **Global chrome stays live during a call.** The chat header ⋮ (search, re-enter voice), the back arrow, the top app bar and the phone bottom tab bar all remain tappable while the receptionist is talking. Search opens a panel above the call; navigation ends it. | `11-in-call-375.png`, `04-listening-1440.png`       | Treat an active call as immersive: hide the bottom tab bar and disable the header menu, or confirm before leaving.     |
| 4   | **Mic denial is labelled "CONNECTION ISSUE".** The body correctly says the microphone is blocked.                                                                                                                                                                    | `15-error-microphone-1440.png`                      | Derive the label from the failure code: "Microphone blocked" / "Couldn't connect" / "Call ended".                      |
| 5   | **Super-admin number fields save on every keystroke.** `onChange` calls a PATCH with the parsed partial value, so typing `100` writes `1`, then `10`, then `100`; typing `0.06` briefly skips `0` and `0.0` as invalid.                                              | `AiPlatformKillSwitchCard.tsx` `handleNumberChange` | Commit on blur or on a short debounce, and validate before sending.                                                    |
| 6   | **Super-admin tabs break at 375 px.** Five secondary tabs wrap; the active "Controls" tab drops to a second line and reads as a button.                                                                                                                              | `21-super-admin-ai-375.png`                         | Horizontal-scroll tab strip or a mobile select, matching the admin secondary-nav pattern.                              |
| 7   | **No focus management on open/close.** Keyboard focus stays on the ⋮ menu item when the panel replaces the thread, and is not returned to the trigger on close.                                                                                                      | `VoiceSessionPanel.tsx`                             | Move focus to the panel (heading or Start call), trap nothing, and restore focus to the trigger.                       |
| 8   | **The session cap arrives without warning.** The countdown is an unexplained `mm:ss`; at zero the call just ends. The production-readiness plan calls for a spoken ordinal "I have to wrap up" and a near-limit countdown.                                           | `11-call-ended-1440.png`, `startSessionClock`       | Explain the timer ("9 min left"), switch to amber under 60 s, and have the assistant say it is wrapping up.            |

---

## P2 — polish that changes how the module feels

1. **Desktop booth is top-heavy.** At ≥1024 px the avatar sits at the top of a 52 rem card and the
   bottom third is empty (`04-listening-1440.png`). Center the booth vertically or use a two-column
   layout (avatar + transcript) from `lg`.
2. **"Message host" ends the call immediately.** It sits next to mute, is the widest control, and
   neither confirms nor prefills the composer. A guest reaching for mute can drop the call. Confirm
   or move it into an overflow action.
3. **Three names for one assistant.** The menu says "Talk to receptionist", the panel says "AI voice
   receptionist", the greeting says "I am Kame", and marketing says "Kame answers". Pick one public
   name and one disclosure line.
4. **Consent copy is technically accurate but vague.** "Captions may be stored" does not say for how
   long (30 days) or where (this thread). One short clause fixes it.
5. **No "AI can make mistakes" inside the call.** The chat composer carries that caveat; the call
   surface hides it. Airbnb's assistant keeps the caveat visible.
6. **Org AI card repeats the same property list twice**, once under Dashboard assistant and once
   under Voice receptionist, with no select-all and no count (`17-org-voice-settings-1440.png`).
   Replace with a one-line summary + Manage sheet on orgs with many properties.
7. **Persona prompt is a blank 3-row box** with `maxLength={300}` but no placeholder, counter or
   example. Hosts do not know what a good persona line looks like.
8. **`Test voice` is full-width on phone** (`18-org-voice-settings-375.png`), and the floating app
   switcher overlaps the voice card at 375 px. `settings-action` should stay a compact inline
   action; the floating control needs a safe gutter over settings content.
9. **Super-admin card is a wall.** 13 feature switches, 7 numeric fields, health, reliability, and a
   UUID textarea share one flat card (`19`, `20`, `21`). Group into Runtime / Features / Costs /
   Rollout / Health, collapse p95 telemetry behind "Health details", and replace the UUID textarea
   with a property picker.
10. **Platform warning/destructive tokens are not text-safe.** `--warning` is 1.8:1 and
    `--destructive` 3.8:1 on white. Add text variants (e.g. `--warning-text`) or standardise on
    `-700/-300` shades for small status text across the app.

---

## P3 — small, safe improvements

- Consecutive assistant utterances merge into one bubble (greeting + answer + tool preamble read as
  one paragraph). Insert a small gap or timestamp between turns.
- The pre-call header strip is an empty 44 px row containing only the close control. Show "Ready to
  call" or collapse the row.
- `supportsWebGl()` creates a WebGL context and never releases it; call
  `getExtension('WEBGL_lose_context')?.loseContext()` before returning.
- Ended state shows both an X and a **Done** button. One is enough.
- The status label "You're speaking" competes with the avatar; consider "Listening to you".

---

## Flow notes

### Entry

- Full-screen messages page: header ⋮ → **Talk to receptionist**. One item when the thread is empty.
- Contact-host sheet: same item; Escape and overlay clicks are suppressed mid-call, which is correct.
- Discovery is the weak point (P1-1). The FAQ starters are good content but do not mention voice.

### Disclosure

- One screen, one primary action, Privacy link, and a remembered acceptance by version. Good.
- The avatar and ring are visible before consent, which sets the expectation without requesting the
  mic. Good.
- Copy is compact. It does not mention retention length or that the assistant can be wrong.

### In call

- States: Connecting, Listening, You're speaking, Thinking, Looking that up, Speaking, Reconnecting,
  Ending, Call ended, Connection issue. The 320 ms dwell prevents flicker. Confirmed on screen.
- Captions keep a stable id while streaming and commit after a 450 ms debounce. Long answers scroll;
  the composer is replaced, so there is no in-call typing (handoff instead).
- The mic stays hot during AI speech, so barge-in works. Mute sends `audioStreamEnd` immediately.
- Action cards are full-width links, deduped and capped at three, allowlisted to internal routes.
- Phone: 44 px targets, safe-area footer, no horizontal overflow at 375/768/1024/1440.
- Global chrome stays live (P1-3). The call is not immersive.

### End

- End shows "Call ended", keeps the captions, offers **Delete captions** + **Done**.
- Idle: "Still there? The call ends soon if it stays quiet." at 30 s, ends at 45 s.
- Offline: "Waiting for your connection…", then a text fallback after 10 s.
- Hard cap: silent end at `maxSessionSeconds` (P1-8).
- Transcript returns to the thread server-side; the panel does not re-render the thread itself.

### Host controls

- Org AI: master switch gates everything; voice toggle, voice picker with preview, persona, per
  property opt-out, and 30-day usage (today, calls, avg length, est. cost, failed %, handoff %).
- Property-level voice config was removed in favour of org-level config plus per-property opt-out.
- Super admin: global enable, feature allowlist, quota defaults, cost rates, rollout %, retention,
  property allowlist, provider health, and reliability percentiles.
- Usage windows mix: the "Today" stat sits under a "Last 30 days" heading. Label the windows per
  stat or split the rows.

---

## Copy audit (selected)

| Where            | Current                                                                              | Suggested                                         |
| ---------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Chat menu        | Talk to receptionist                                                                 | Talk to Kame (AI)                                 |
| Disclosure title | AI voice receptionist                                                                | Talk to Kame                                      |
| Disclosure body  | Uses your microphone and Google Gemini. Audio is not stored. Captions may be stored. | Add "Captions are kept in this chat for 30 days." |
| Mic error status | Connection issue                                                                     | Microphone blocked                                |
| Countdown        | 8:59                                                                                 | 8:59 left (or "9 min left")                       |
| Handoff          | Message host                                                                         | Message the host (ends the call)                  |
| Delete captions  | Delete captions                                                                      | Delete captions + confirm dialog                  |
| Org usage        | Last 30 days / Today / Calls ...                                                     | Today · last 7 days · last 30 days per stat       |
| Super admin      | Voice reliability / Startup p95 ...                                                  | Move under a "Health details" disclosure          |

House style: short, plain, no em dashes.

---

## Accessibility notes

- Verified: 44 px targets, labelled icon buttons, `aria-pressed` on mute, `role="alert"` on errors,
  polite status label, decorative ring/meter `aria-hidden`, no horizontal overflow at 375–1440.
- Fixed: caption announcement, countdown accessible name, status/error contrast.
- Open: focus move on open/close, a visible focus ring on the poster fallback (not focusable, fine),
  and the `aria-live` status switching text while the guest is speaking (it can interrupt a screen
  reader; consider `polite` only, already polite, or announcing only on state change past 1 s).
- Motion: `prefers-reduced-motion` already freezes the ring and avatar; the panel fade is skipped.

---

## Test coverage

| Area                        | Where                                                                   |
| --------------------------- | ----------------------------------------------------------------------- |
| Disclosure / consent        | `voiceReceptionistConsent.spec.ts`                                      |
| Mic denied, provider outage | same                                                                    |
| Captions, actions, barge-in | same                                                                    |
| Reconnect, GoAway           | same                                                                    |
| Idle timeout, offline       | same                                                                    |
| Session cap                 | same                                                                    |
| Handoff                     | same                                                                    |
| Visual states + breakpoints | `aiReceptionistWalkthrough.spec.ts` (`@demo`)                           |
| Dark theme, admin surfaces  | same                                                                    |
| State machine / protocol    | `voiceSessionState`, `voiceSessionView`, `liveVoiceProtocol` unit tests |
| Server contract             | `voiceReceptionistContracts.test.ts`                                    |

Still manual by design: a real microphone and a real Gemini Live session. Use
`docs/guides/testing/voice-receptionist-manual.md` on Chrome desktop, Android Chrome, iOS Safari and
macOS Safari, including headset/Bluetooth, noisy room, background/foreground, and a long pause.

---

## Recommended order

The decision board groups the same findings into three phases:

- **Phase 1, quick wins:** A3 delete confirm, A4 failure labels, A6 naming and consent copy, B1
  number fields, B2 phone tabs, B3 focus. About one day, small diffs.
- **Phase 2, call experience:** A1 discovery, A2 immersive call, A5 cap warning, B4 handoff,
  B5 desktop composition. Two to three days.
- **Phase 3, operator polish:** B6 org settings, B7 super-admin grouping, B8 text tokens. When
  the module is next open.
- **Skip:** C1 to C8 in the board, with the reason for each.

Each item is small enough to ship independently. Nothing in phase 1 or 2 requires a schema change;
the spoken cap warning is a prompt and client-timer change.
