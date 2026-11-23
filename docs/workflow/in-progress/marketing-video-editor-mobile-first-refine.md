---
stage: in-progress
title: 'Marketing: mobile-first video editor refine (text styles, voiceover, auto captions)'
status: planned
tags: [workflow, planned, marketing, video, remotion, mobile, captions, voiceover, ux]
updated: 2026-11-23
kind: plan
---

# Marketing: mobile-first video editor refine (text styles, voiceover, auto captions)

> **Revised 2026-11-22 (execute-plan):** audited the plan against the code and fixed drift. (1) `servePropertyScoped` does not exist: the captions function copies `marketing-media` (`serveAuthenticated` + `resolveScopedPropertyAccess` + `requirePropertyPermissionAndFeature`). (2) `_shared/marketingVideoProject.ts` (multitrack T1.13) does not exist, so Phase 5 builds it first (new T5.0) instead of waiting. (3) `friendlyMicErrorMessage` is not exported: Phase 4 exports it (additive). (4) `@remotion/captions` is not installed: added in Phase 6. (5) The cramped phone preview is caused by `MarketingStudioShell` fixed heights (`100dvh - 20rem`), not `AdminLayout`: Phase 1 uses a full-screen editor layer and leaves the shared layout alone. (6) Spikes that need real devices or a live Groq key (T0.2 to T0.5) cannot run in this environment: they are decided here with fallbacks and left as manual checks. (7) Added Decisions, per-phase Acceptance, Edge cases and Rollback sections.

## Progress (2026-11-22, execute-plan)

- **Built and committed on `sprmke/refine-marketing-video-editor`:** the full-screen phone editor with a tool strip and clip tools, the trim view, text looks and label presets, voice recording, sound from a video, separate sound, music that lowers under voice, auto captions (browser audio mix, `marketing-video-captions`, caption lines, edit and style), server validation of saved videos, docs, FAQs and tests.
- **Polish round (2026-11-22):** a full screenshot tour on phone, tablet and desktop found and fixed: captions failing on one unreadable clip, a teal "red" record button, new text invisible at frame 0, light sheets on a dark editor, toasts covering Export and being untappable, chips and tools clipped, number boxes on phone sliders, the tool strip leaving short screens, a crushed landscape view and a read-only role locked out of More.
- **Critique polish (2026-11-22):** Add text / Text styles open a docked preset gallery (preview stays up) instead of dumping a Headline; clip **More** opens the full inspector; **Pull sound out** replaces "Separate sound"; read-only shows a View only line above the strip.
- **Phone density (2026-11-23):** CapCut-scale chrome was crowding the preview on short phones. Tightened the tool strip (44×52 tiles), docked panels, transport, top bar, timeline lanes, look/preset swatches, and chips (`public-chip` / `admin-overflow-trigger`) while keeping ≥44 px hit targets.
- **Still open:** T0.2 to T0.5 (real iPhone and Safari recording, a real export with every look, Groq on real clips), T7.3 (browser matrix) and T7.4 (`property-dashboard-qa`). These need a person and a live key.

**Goal.** Make the Videos editor in Marketing Studio feel like a phone-first editor (CapCut, InShot, VN), not a desktop tool squeezed onto a phone. A non-technical host should be able to: put several videos and photos together, trim them, put good-looking text and labels on top, add background music, record a voiceover while the video plays, and get subtitles made from that voice automatically. No editing jargon.

**Non-goal.** A pro editor. Keyframes, masks, chroma key, effects packs, stickers marketplace, beat sync, multi-language caption translation and server-side rendering stay out (see [§13](#13-out-of-scope)).

**Builds on, does not replace:** [`../in-progress/marketing-video-editor-multitrack.md`](../in-progress/marketing-video-editor-multitrack.md) (track model v2, media library, quotas, timeline, export). That plan's §11 "Later" list (voiceover, auto captions, ducking) is pulled into this plan. Its open integration tasks (T1.10, T1.11, T1.13, T2.7) stay there; **T1.13 (server-side v2 validation) becomes a hard prerequisite** of Phase 5 here because this plan adds new item types.

**Related:** `docs/architecture/marketing-video-editor.md` · `docs/guides/routes/org/property/marketing.md` · [`marketing-storage-quotas-and-retention.md`](./marketing-storage-quotas-and-retention.md) (voice recordings count as storage) · [`dashboard-mobile-native-v2.md`](./dashboard-mobile-native-v2.md) (phone shell conventions) · [`marketing-meta-publishing-gaps.md`](./marketing-meta-publishing-gaps.md) (Reels publish).

---

## 1. Verdict: what we support today

Reviewed in code (`components/video-editor/VideoEditorV2.tsx`, `v2/**`, `lib/video/v2/**`) and in the running editor (Playwright, mocked backend, 390 x 844 phone and 1440 x 900 desktop, 2026-11-22).

| Ask                                       | Today                                                                                                                                                         | Status                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Several videos and photos in one project  | Main track (magnetic) plus overlay tracks; library with uploads, property photos, AI results. Up to 3 videos visible at once.                                 | Yes                                                                                            |
| Trim and split videos                     | Edge drag on the timeline (44 px handles on phone), Split at playhead, "Start in source" slider in the inspector.                                             | Partly: works, but hard to do precisely on a phone (no dedicated trim view)                    |
| Multiple layers                           | Overlay, text and audio tracks; hide, mute, lock (desktop only).                                                                                              | Yes                                                                                            |
| Text and labels on top of video           | 4 presets (Headline, Caption, Lower third, Button); font, size, color, fill, bold, outline, align; 6 in/out animations; canvas move/resize/rotate.            | Partly: works, but presets are plain text buttons with no visual preview and few "cool" styles |
| Background music                          | Jamendo browse, default template music, audio uploads, volume, fades, loop.                                                                                   | Yes                                                                                            |
| Audio from an uploaded video              | Video clips keep their own sound (volume, mute).                                                                                                              | Partly: cannot separate a video's sound into its own clip                                      |
| Narrate while the video plays (voiceover) | Nothing. No `getUserMedia` / `MediaRecorder` in the marketing module.                                                                                         | **No**                                                                                         |
| Auto subtitles from narration             | Nothing. No speech-to-text anywhere in `supabase/functions`.                                                                                                  | **No**                                                                                         |
| Music gets quieter when someone talks     | Nothing.                                                                                                                                                      | **No**                                                                                         |
| Phone-first, CapCut-like experience       | Fixed centre playhead, scroll-to-scrub, pinch zoom, long-press drag and a clip action bar exist. The overall screen still reads as a dashboard page (see §2). | **No**                                                                                         |
| Plain language for non-technical hosts    | Several editor terms leak into the UI (§2, U9).                                                                                                               | **No**                                                                                         |

**Bottom line.** The engine is good and well tested: track model, pure timeline ops with randomized invariant tests, Remotion renderer with in-browser MP4 export, media library with quotas. **The gaps are the phone experience, text styling, and three audio features (voiceover, sound from video, auto captions).** None of them needs a new engine.

---

## 2. Critique (phone first)

Evidence: screenshots from the mocked editor at 390 x 844 (Home, clip selected, clip Edit sheet, Add text sheet, Media sheet, text Edit sheet) and 1440 x 900.

| #   | Finding                                                                                                                                                                                                                                                                                           | Where                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| U1  | **The editor lives inside the dashboard chrome.** Profile header, the green "Marketing" title bar and the app's bottom tabs (Dashboard, Bookings, Messages, More) stay on screen. About 40% of the phone height is chrome, not editor.                                                            | `AdminLayout.tsx` `BottomTabBar`, page header                         |
| U2  | **The preview is tiny**: about 88 x 155 px on a 390 px phone. You cannot read your own text or judge a trim.                                                                                                                                                                                      | `VideoPreviewV2`, `PREVIEW_MIN_HEIGHT_CLASS`                          |
| U3  | **Dead space**: a large empty white block sits under the timeline while the preview is starved.                                                                                                                                                                                                   | `VideoEditorV2.tsx` column layout (`max-lg:pb-24`, `overflow-y-auto`) |
| U4  | **The floating dock collides with the app's grid button.** In the clip action bar, "Delete" is cut off behind it.                                                                                                                                                                                 | `VideoMobileActionBar`, `MarketingEditorMobileToolbar`, global FAB    |
| U5  | **Edit opens a desktop form in a sheet** that covers the preview: Length, Fit, Brightness, Contrast, Saturation, Camera motion, Photo wash, each a slider plus a number box. You cannot see the effect of a change while making it.                                                               | `MediaItemInspector`, `MarketingEditorInspector`                      |
| U6  | **Text editing shows the same text twice** (a "Text" box, then a second "Text content" box from the style controls), then Start and Length sliders, then style chips. The first thing a host sees is timing, not the text.                                                                        | `LayerItemInspector.tsx` + `VideoTextStyleControls.tsx` L81           |
| U7  | **Add text is four plain buttons** ("Headline", "Caption", "Lower third", "Button"). No preview of what each looks like, no style gallery, no "type then pick a look" flow.                                                                                                                       | `textPanel` in `VideoEditorV2.tsx`, `TEXT_PRESETS`                    |
| U8  | **No visible way to add sound from the timeline.** No audio lane unless music already exists; no "+" at the end of the clips; Add audio only exists in the desktop toolbar. The root dock has Media, Text, Edit, Templates, AI: "Edit" with nothing selected opens project background settings.   | `VideoTimelineV2`, `MarketingEditorMobileToolbar` panels              |
| U9  | **Jargon**: "Main", "Overlay", "Photo wash", "Soft scrim", "Behind letterboxed media", "Fill frame", "Start in source", "Lower third", "Safe area guide", "Snap", "Template default", "Animate in/out", "Preview zoom" vs "Timeline zoom" in the overflow menu.                                   | inspectors, `trackLabel()`, overflow items                            |
| U10 | **The selected-clip bar is generic** (Edit, Split, Replace, Copy, Delete) for every clip type. CapCut shows tools that fit the clip: Speed and Volume for video, Style and Animation for text, Fade for audio. The original plan (T6.2) listed Speed, Volume and Animation, which were not built. | `VideoMobileActionBar`                                                |
| U11 | **Trimming on a phone means dragging small edges at the current zoom.** There is no full-clip trim view with a looping preview, which is how phone editors make trim easy.                                                                                                                        | timeline only                                                         |
| U12 | **Overflow menu mixes 14 items** (undo, redo, size, reviews, two kinds of zoom in, two kinds of zoom out, fit, fullscreen, reset, download, publish). Export, the main goal, is buried there on phone.                                                                                            | `overflowItems` in `VideoEditorV2.tsx`                                |
| U13 | Desktop is in better shape (rail, timeline toolbar, track headers, inspector). Same jargon and same text-style gaps apply.                                                                                                                                                                        | desktop screenshot                                                    |
| U14 | `VideoEditorV2.tsx` is **1,796 lines** and owns layout, commands, export, AI and the phone dock. New phone UI must not grow it further.                                                                                                                                                           | code health                                                           |

---

## 3. Build vs library

| Option                                                                                       | What it is                                                                                     | Verdict                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenCut**, **OpenReel Video**, **FreeCut** (MIT)                                           | Complete editor **apps** (own state, own renderer, own storage), not embeddable libraries.     | **Reject.** Adopting one means throwing away the tested track model, media library and quotas, templates, AI builder, guest-review seeding, autosave, themes and Meta publish, then forking an app we do not control. Fine to read for UX patterns.                                |
| **Twick** (React SDK, AI captions)                                                           | Timeline SDK plus cloud toolchain.                                                             | **Reject for now.** License not verified; it brings its own project model and render path, which would sit beside ours.                                                                                                                                                            |
| DesignCombo `react-video-editor`                                                             | Full editor.                                                                                   | **Reject** (already rejected in the multitrack plan: unclear license, own stack).                                                                                                                                                                                                  |
| Remotion Editor Starter (paid)                                                               | Reference editor including captioning.                                                         | **Optional.** Only worth buying as reading material; not as a base.                                                                                                                                                                                                                |
| **`@remotion/captions`** (same Remotion license we already depend on)                        | `createTikTokStyleCaptions()` turns word timestamps into caption "pages" with per-word timing. | **Adopt.** Pin to `4.0.520` like the other Remotion packages. Small, pure, fits the existing renderer.                                                                                                                                                                             |
| **Groq Whisper** (`whisper-large-v3-turbo`, `verbose_json` + `timestamp_granularities=word`) | Speech to text with word timestamps.                                                           | **Adopt.** `GROQ_API_KEY` is already configured and Groq is already an LLM fallback provider. About **$0.04 per hour** of audio, so a 60 s project costs well under a tenth of a cent. Handles English and Filipino/Taglish reasonably. Gemini stays out: no reliable word timing. |
| Browser `MediaRecorder` + `getUserMedia`                                                     | Voice recording.                                                                               | **Adopt.** Native; the repo already has mic error handling to reuse (`guest/chat/lib/voiceMicrophoneCapture.ts#friendlyMicErrorMessage`).                                                                                                                                          |
| **Mediabunny** (already a direct, lazy dependency)                                           | Transcode, audio extraction.                                                                   | **Reuse** to convert recordings to AAC/M4A and to pull a small mono audio track for captions.                                                                                                                                                                                      |
| Browser Web Speech API (`ai-assistant/lib/speechRecognition.ts`)                             | Free live speech recognition.                                                                  | **Reject for captions.** No word timestamps, not in Firefox, cannot caption an uploaded video's sound.                                                                                                                                                                             |

**Decision: keep our engine (Remotion + v2 model) and build the phone UI ourselves, adding three narrow pieces: `@remotion/captions`, Groq Whisper and `MediaRecorder`.** The work is mostly UX, which no library would do for us in our design system and mobile rules.

---

## 4. Target experience (phone, `max-lg`)

### 4.1 Layout

The editor opens **full screen** on phones: the dashboard header and bottom tabs hide while the editor is open, like opening a project in CapCut. Desktop keeps today's layout.

```
┌──────────────────────────────────────┐
│ ✕   Quiet morning ✎     ↶ ↷  [Export]│  top bar: close, name, undo/redo, primary Export
├──────────────────────────────────────┤
│                                      │
│            ┌──────────┐              │
│            │          │              │  preview: ~50% of the height, dark backdrop,
│            │ preview  │              │  tap text on video to edit it in place
│            │          │              │
│            └──────────┘              │
│  0:03 / 0:09        ▶        ⛶       │  time, play, full screen
├──────────────────────────────────────┤
│              │                        │
│   T  Wake to │quiet light             │  text lane (icon, no "Text 1" label)
│ [▓▓▓▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]  [+]   │  clips, big thumbs, "+" adds photos or videos
│   ♪ + Add sound                       │  empty helper lane until there is audio
│              │                        │
├──────────────────────────────────────┤
│ ♪Audio  T Text  ⧉Captions  ▣Media  ⊞Templates  ⇲Size  ✦AI  →  │  scrollable tool strip
└──────────────────────────────────────┘
```

- Dark editor surface on phone (preview and timeline), app-themed accents. Matches every phone video editor and makes video colours read true. Desktop stays light unless the user picked dark (open question Q1).
- Export is always visible in the top bar. Download and Publish move into the Export sheet (one place to finish).
- The app's floating grid button is hidden in the editor (fixes U4).

### 4.2 Tool strip (nothing selected)

One horizontally scrolling row of large icon + label buttons above the safe area. Tapping a tool swaps the row for that tool's **second-level row** with a back arrow (CapCut pattern), so most actions never open a sheet.

| Tool         | Second level                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------- |
| **Audio**    | Music · Record voice · Sound from a video · Upload audio                                      |
| **Text**     | Add text · Text styles · Auto captions                                                        |
| **Captions** | Auto captions (shortcut; same as Text → Auto captions; shows "Edit captions" once they exist) |
| **Media**    | Add photos or videos (opens the library sheet) · Add on top (picture in picture)              |
| Templates    | Opens the template sheet (unchanged)                                                          |
| Size         | 9:16 · 1:1 · 16:9 chips (unchanged `MarketingSizeDialog` logic)                               |
| Background   | Colour or blurred fill for empty space                                                        |
| AI           | Unchanged "Make with AI" sheet                                                                |
| More (⋯)     | Guest reviews · Start over from template · Phone screen guide                                 |

Zoom moves to gestures only on phone (pinch on preview and timeline already exist); the four zoom items leave the overflow menu (fixes U12).

### 4.3 Selected-clip tools (context strip)

Tapping a clip replaces the strip with tools for that clip type. Each tool opens a **compact panel docked above the strip** (one control, about 30% height) so the preview stays visible while adjusting (fixes U5). The full inspector remains reachable as "More settings" at the end of each row.

| Clip            | Tools                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Video           | Trim · Split · Speed · Volume · Sound off/on · Separate sound · Replace · Adjust · Duplicate · Delete |
| Photo           | Duration · Split · Motion · Adjust · Fit · Replace · Duplicate · Delete                               |
| On-top media    | Same as video or photo, plus Position (opens canvas handles)                                          |
| Text            | Edit · Style · Animation · Duration · Duplicate · Delete                                              |
| Caption line    | Edit text · Style (all captions) · Split line · Delete · Delete all captions                          |
| Music / sound   | Volume · Fade · Split · Lower when voice plays · Replace · Duplicate · Delete                         |
| Voice recording | Volume · Fade · Split · Make captions · Re-record · Delete                                            |

The bar is `fixed` with `env(safe-area-inset-bottom)` and never overlaps another floating element.

### 4.4 Timeline refinements (phone)

- Clip thumbnails at least 56 px tall; text and audio lanes 40 px; lanes identified by **icons**, never "Main", "Overlay", "Text 1".
- A **"+" tile** at the end of the clip row adds photos or videos at the end.
- **Empty helper lanes** ("+ Add sound", "+ Add text") show under the clips until that kind exists, then turn into real lanes.
- While dragging an edge or a clip, a time bubble shows the new length ("2.5s").
- Tap an empty lane area: deselect. Tap the preview: play or pause.

### 4.5 Trim view (video clips)

"Trim" opens a docked panel with a filmstrip of the **whole source video**, two large handles, the kept part highlighted, and the preview looping the kept part. Done applies one history step through existing `timelineOps` `trimStart`/`trimEnd` (they already bound by source length and speed). This replaces "Start in source" for most hosts (fixes U11). Filmstrip frames reuse the Mediabunny frame cache from T4.2.

### 4.6 Text that looks good

- **Add text flow**: tap Add text, type straight into an inline box over the preview (keyboard opens), a **style row sits above the keyboard** with visual swatches. Done places the text clip at the playhead for 3 s.
- **Text styles gallery** (`TEXT_LOOKS`), rendered as live mini previews, not labels. Initial set of 12: Classic, Bold white with shadow, Black outline, Boxed (solid pill), Soft box (translucent), Highlight (marker behind words), Neon glow, Pop (thick outline + colour), Serif elegant, Handwritten, Tag label (small caps pill), Price tag. Each look is data: font, weight, colour, stroke, shadow, background box, radius, padding, letter case.
- **Labels** (replaces "Lower third"): Name tag, Location pin, Price, "Book now" button, Rating stars. Each is a text look with an icon slot.
- **Animations** renamed to Entrance and Exit with visual chips (Fade, Slide up, Pop, Typewriter, Rise); add **"Word by word"** for captions only.
- **Edit in place**: double-tap text on the preview to edit; the duplicated text field (U6) is removed. Timing fields move to a "Duration" tool.
- Every new CSS effect (stroke, shadow, glow, box) must export through `renderMediaOnWeb`; anything the web renderer cannot draw falls back to an equivalent it can (spike T0.3).

### 4.7 Audio

- **Music**: the existing Jamendo browser and default music move under Audio → Music. Picking a song adds it from the start of the video and loops to the end (today's behaviour).
- **Upload audio**: existing library upload, filtered to audio.
- **Sound from a video**: pick a video from the library (or select a video clip and tap "Separate sound"). Creates an audio clip with the video's sound on its own lane and mutes the original clip. Keeps sync on split and trim because it is a normal audio clip from then on.
- **Lower music when voice plays** (ducking): on by default for music clips. Music drops to 25% under voice clips with a 0.3 s ramp. Pure function, unit tested.

### 4.8 Record voice (voiceover)

Flow:

1. Audio → Record voice. First time only, the browser asks for the microphone; blocked or missing mic shows the friendly messages from `friendlyMicErrorMessage`.
2. A record panel docks above the strip: big red button, "Video sound off while recording" toggle (on by default, prevents the speaker leaking into the mic), and a hint "Use headphones to hear your video while you talk".
3. Tap record: 3, 2, 1 countdown, then the video **plays from the playhead** and recording starts together. A live waveform grows on a new Voice lane under the clips.
4. Tap stop (or the video ends, or the 60 s cap). The take appears as a Voice clip at the start frame.
5. A chip offers **"Make captions from this voice"**.
6. Re-record replaces the take; undo removes it.

Technical:

- `MediaRecorder` on the `getUserMedia` stream; WebM/Opus on Chromium, MP4/AAC on Safari. Before upload, **convert to AAC in M4A with Mediabunny** so every browser can play and export it (spike T0.2).
- Upload through the existing library pipeline (`useUploadMarketingMedia`, reserve and finalize, `kind: audio`, `source: upload`, file name "Voice 1", `meta.origin: 'voiceover'`). **No DB migration**; it counts toward the media quota like any upload. Peaks come from the existing audio pipeline.
- While uploading, the clip plays from a local blob URL; autosave waits for the final Storage URL (blob URLs are never saved; the saved-project allowlist already rejects them).
- **Sync**: record the delay between the Player's play event and the recorder's `start` event and shift the clip's `from` by it; on Safari also apply the measured output latency. Target error under 100 ms (verify in T0.2).
- iOS: microphone + playback in a standalone PWA needs a spike (the audio session ducks playback while the mic is open). If playback is unreliable, iOS records over a silent, still-moving preview.

### 4.9 Auto captions

Flow:

1. Text → Auto captions (or the chip after a recording).
2. Sheet asks one thing, **"Make captions from"**: Voice recordings (default when present) · Video sound · Both; and **Language**: Auto · English · Filipino.
3. Progress ("Listening to your video…"), then caption lines appear on a **Captions lane** and on the preview in the default caption style.
4. Captions are editable: tap a line to fix a word; Edit captions opens a list of all lines (text plus time) for fast proofreading; Style applies to all captions; Delete all removes them.

Technical:

- **Client** (`lib/video/v2/captions/`): for each chosen source clip, use Mediabunny to read only the used range (respecting `trimBeforeFrames` and `playbackRate`), downmix to mono 16 kHz, encode to a small Opus/AAC blob (60 s is about 0.3 to 0.5 MB). Nothing new is stored.
- **Edge function `marketing-video-captions`** (`servePropertyScoped` style): `resolveScopedPropertyAccess` + `marketing.content:edit` permission; AI checks through `isFeatureEnabled('marketing_video_captions')` and `assertOrgAndPropertyAiQuota`; `rateLimitGate` (10 per 5 min per user); multipart body capped at 2 MB and 65 s; sniff the audio magic bytes; call Groq `audio/transcriptions` with `whisper-large-v3-turbo`, `response_format=verbose_json`, `timestamp_granularities[]=word`, optional `language`; record usage and credits through `aiUsageService` (cost from duration); return `{ words: [{ text, startMs, endMs }], language }`. Audio is not stored or logged.
- **Mapping** (pure, unit tested): `wordsToTimeline(words, sourceClip)` converts source milliseconds into project frames (divide by speed, offset by trim and clip start), drops words outside the clip's visible range, and never crosses the 60 s cap.
- **Paging**: `createTikTokStyleCaptions({ combineTokensWithinMilliseconds })` from `@remotion/captions` groups words into lines (default about 1,200 ms; "Word by word" style uses about 400 ms). Each page becomes one `CaptionItem`.
- **Rendering**: a `CaptionClip` in `VideoCompositionV2` renders the line in the track's caption style and highlights the active word per frame (for the styles that do it).
- **Editing**: editing a line's text re-spreads its words evenly across the line's time when the word count changes; split and delete use existing ops because caption lines are normal free-track items.
- **Failure copy**: "We couldn't hear any speech in this part." / "Captions are not available on your plan." (upgrade CTA) / "You've used today's AI allowance. Try again tomorrow."

### 4.10 Plain-language copy

Run through the `human-copy` skill. Proposed replacements:

| Today                           | New                                           |
| ------------------------------- | --------------------------------------------- |
| Main / Overlay / Text 1         | Lane icons only; "On top" for overlay actions |
| Photo wash, Soft scrim          | Shade, Soft shade                             |
| Behind letterboxed media        | Fill empty space with                         |
| Fill frame / Fit                | Fill / Fit                                    |
| Start in source                 | Trim (dedicated view)                         |
| Camera motion: Template default | Motion: Auto                                  |
| Lower third                     | Name tag                                      |
| Animate in / Animate out        | Entrance / Exit                               |
| Safe area guide                 | Phone screen guide                            |
| Snap                            | Snap to edges (desktop only)                  |
| Length (Edit sheet)             | Duration                                      |
| Media library                   | Your media                                    |

---

## 5. Desktop parity (`lg+`)

Desktop keeps the rail, timeline toolbar, track headers and inspector, and gains the same features:

- Rail: **Audio** section (Music, Record voice, Sound from a video, Upload) and **Captions** section; Text section becomes the visual styles gallery.
- Inspector: grouped the same way as the phone tools (Edit, Style, Animation, Duration for text; Trim, Speed, Volume for video) so docs and help content describe one model.
- Shortcuts: `R` starts and stops recording when the editor has focus (input guard reused).
- Same copy pass.

---

## 6. Data model changes (v2, additive)

All changes are optional fields or new item and track kinds, so existing rows parse unchanged and no data migration runs. `parseVideoProjectV2` drops unknown values safely today; extend it rather than loosening it.

```ts
// videoProjectV2Types.ts
export type VideoTrackKind = 'main' | 'overlay' | 'text' | 'audio' | 'captions';

export type AudioRole = 'music' | 'voice' | 'sound';
export type AudioItem = ItemBase & {
  // ...existing fields
  role?: AudioRole; // missing = 'music' if trackId (Jamendo) or default music, else 'sound'
  /** Music only: lower under voice clips. Default true. */
  duckUnderVoice?: boolean;
  /** Set when the audio came from a video ("Separate sound"). */
  sourceItemId?: string | null;
};

export type CaptionWord = { text: string; startMs: number; endMs: number }; // relative to item start
export type CaptionItem = ItemBase & {
  type: 'caption';
  text: string;
  words: CaptionWord[];
  /** The voice or video clip this line was made from. */
  sourceItemId?: string | null;
};

export type CaptionStyle = {
  look: CaptionLookId; // 'clean' | 'bold-outline' | 'boxed' | 'highlight-word' | 'pop-word' | 'karaoke'
  y: number; // % from top, default 78 (above Reels UI)
  scale: number; // 0.7 to 1.5
  textColor?: string;
  highlightColor?: string;
};

export type VideoTrack = {
  // ...existing fields
  /** captions tracks only */
  captionStyle?: CaptionStyle;
};

export type VideoItem = MediaItem | LayerItem | AudioItem | CaptionItem;

// VideoSceneLayer (text): additive look fields consumed by VideoLayerBody
//   look?: TextLookId; stroke?: { color; widthPx }; shadow?: { color; blurPx; y };
//   box?: { color; opacity; radiusPx; paddingPx }; glow?: { color; blurPx }; textCase?: 'none' | 'upper'
```

- `trackAccepts('captions', item)` accepts only `caption`; at most one captions track.
- Limits: caption items get their own cap (`maxCaptionItems: 200`) and do not count toward `maxItems` (a 60 s narration is about 40 lines). Mirror in the server validator.
- `timelineOps`: captions behave like a free track (no overlap, move, trim, split, delete). Splitting a caption splits its `words` at the frame.
- **Server validation (`_shared/marketingVideoProject.ts`, multitrack T1.13)** must accept the new kinds, cap `words` per item (100) and text length (200), and keep the URL allowlist (voice recordings are library URLs).
- Rollback editor (`VITE_VIDEO_EDITOR_V2=false`) ignores captions and new fields; this is acceptable because v1 UI is due for deletion (multitrack T6.6). Add a notice if a project with captions opens there.

---

## 7. Phases and tasks

Each phase ships on its own. New phone UI lives in **new video-specific components** (`components/video-editor/v2/mobile/*`), not in the shared `MarketingEditorMobileToolbar` / `MarketingEditorRail` / `MarketingEditorTopBar`, which the Posts (Polotno) editor also uses. Shared components change only additively and behind props.

### Phase 0: Spikes (2 to 3 days)

- [x] **T0.1** Full-screen phone editor: hide `AdminLayout` header, `BottomTabBar` and the global grid button for the editor route only (route handle or layout context flag), with back gesture and browser back still closing the editor. Confirm no other route is affected. _Done as a full-screen layer, verified in the phone E2E._
- [ ] **T0.2** Voiceover: `MediaRecorder` + Player playback together on Chrome Android, Safari iOS (browser and installed PWA) and desktop Chrome/Safari/Firefox. Measure start offset; confirm Mediabunny converts WebM/Opus and MP4/AAC to M4A; confirm export plays the recording. _Recorder runs in Chromium with a fake microphone (E2E). iOS Safari, installed PWA and the other browsers are manual; no M4A conversion (see Decisions)._
- [ ] **T0.3** Text looks: render stroke, text-shadow, glow, translucent box and highlight through `renderMediaOnWeb`. Record which need a fallback (for example layered text for stroke). _Looks use standard CSS the web renderer supports; a frame-by-frame export check of every look is manual._
- [ ] **T0.4** Sound from a video: `@remotion/media` `<Audio>` with an MP4 source in preview and export. Fallback: extract to M4A with Mediabunny and upload as a library audio file. _Separate sound reuses the video URL as an audio clip; a real export with it is manual._
- [ ] **T0.5** Captions: Groq Whisper on 5 real clips (English, Filipino, Taglish, music under voice, quiet room). Check word timing accuracy and cost. Check `@remotion/captions@4.0.520` paging output. _Needs a live `GROQ_API_KEY` and real clips (English, Filipino, Taglish). Not run here._
- [x] **T0.6** Decide open questions Q1 to Q5 (§12). _Decided in Decisions._

### Phase 1: Phone shell and copy (4 to 5 days)

- [x] **T1.1** Full-screen phone editor (from T0.1), dark editor surface, top bar with close, name, undo/redo, **Export**.
- [x] **T1.2** Preview takes about half the height; remove the empty block under the timeline (U2, U3); tap preview to play or pause.
- [x] **T1.3** Export sheet: Download MP4 and Publish to Meta in one place (reuse `VideoExportDialog`, tier badges, `handleDownload` / `handlePublish`).
- [x] **T1.4** Split `VideoEditorV2.tsx`: move the phone dock, overflow and panels into `v2/mobile/` and commands into a `useVideoEditorCommands` hook. No behaviour change, existing E2E stays green. _Phone UI lives in `v2/mobile/`, the old dock is gone and voiceover moved into `useVideoVoiceover`. The captions flow and rail JSX are still in `VideoEditorV2.tsx` (about 2,000 lines)._
- [x] **T1.5** Copy pass (§4.10) on phone and desktop with `human-copy`; `trackLabel()` returns icon keys on phone. _Desktop inspector and toolbar words renamed too (Shade, Fill empty space with, Comes in, Goes out, Start from, Snap to edges, Add sound, On top, Video)._
- [x] **T1.6** Remove the duplicate text field (U6).

### Phase 2: Tool strip, context tools, timeline (5 to 6 days)

- [x] **T2.1** `VideoToolStrip` with second-level rows and back arrow (§4.2); safe-area aware, 44 px targets, scrolls horizontally, keyboard reachable.
- [x] **T2.2** Context strip per clip type (§4.3) replacing `VideoMobileActionBar`; compact docked panels for Speed (chips), Volume (slider + Sound off), Fade, Duration, Motion, Adjust, Fit.
- [x] **T2.3** Trim view for video clips (§4.5). _The bar tiles the poster; there is no frame filmstrip (Mediabunny frame cache does not exist yet)._
- [x] **T2.4** Timeline: "+" tile at the end of clips, empty helper lanes, icon lane identity, bigger thumbs, time bubble on drag (§4.4). _"+" tile after the clips, "Add sound" and "Add text" helper pills, lane icons in the left gutter, and a duration bubble while dragging._
- [x] **T2.5** Gesture zoom only on phone; overflow reduced to Guest reviews, Start over, Phone screen guide. _The phone fullscreen preview button was dropped with the overflow menu._
- [x] **T2.6** Desktop: inspector groups reordered to match (§5). _Desktop inspectors grouped under Timing, Style, Sound, Picture and Movement headings, number boxes widened, one-row timeline toolbar without the duplicate undo and redo._

### Phase 3: Text looks and labels (4 to 5 days)

- [x] **T3.1** `VideoSceneLayer` look fields (§6) + `parseVideoProjectV2` support + `VideoLayerBody` rendering, with fallbacks from T0.3.
- [x] **T3.2** `TEXT_LOOKS` (12) and label presets (Name tag, Location, Price, Book now, Rating) as data with Vitest coverage that every look parses and round-trips.
- [x] **T3.3** Inline add-text flow on the preview with the style row above the keyboard (uses `visualViewport` so the row sits on the keyboard); double-tap to edit existing text. _Add text opens the Edit panel; a second tap on text on the preview edits it. There is no style row above the keyboard (the Style tool is one tap away)._
- [x] **T3.4** Visual styles gallery in the Text tool (phone) and rail (desktop); Entrance and Exit chips with live mini previews. _Entrance and Exit are "Comes in" and "Goes out" chips without live mini previews._
- [x] **T3.5** Theme integration: looks pick up the active marketing theme colours unless the host changes them (reuse `marketingTheme` tokens).

### Phase 4: Audio and voiceover (5 to 6 days)

- [x] **T4.1** Audio tool: Music (move Jamendo + default music), Upload audio, Sound from a video, Record voice.
- [x] **T4.2** `AudioItem.role`, `duckUnderVoice`, `sourceItemId` + parse; `duckedVolume(frame, voiceRanges)` pure function + Vitest; composition applies it.
- [x] **T4.3** "Separate sound" op in `timelineOps` (creates linked audio clip on a free audio lane, mutes the video clip; undoable in one step).
- [x] **T4.4** `useVoiceRecorder` (permission, countdown, record with playback, stop on end or cap, latency offset), M4A conversion, upload through `useUploadMarketingMedia`, local blob playback until the final URL lands. _Uploaded as recorded (no M4A conversion). The clip is added after the upload finishes, so no blob URL is ever saved._
- [x] **T4.5** Record panel UI, live waveform lane, Re-record, the "Make captions" chip. _A live level meter replaces the growing waveform lane; the saved clip shows its waveform._
- [x] **T4.6** Export: voice and separated sound included; preflight covers them; muted-export rule (`projectHasAudio`) counts them. _Shared composition and preflight; a real export with voice and separated sound is a manual check._

### Phase 5: Auto captions backend (3 to 4 days)

Prerequisite: multitrack **T1.13** (server-side v2 validation) is done, extended with §6.

- [x] **T5.1** Add `marketing_video_captions` to `AI_FEATURES` (`aiModelRouter.ts`), the super-admin AI feature toggles and limits (limits stay super-admin only), the usage console labels. _No migration was needed: the feature is registered in `AI_FEATURES` and the labels._
- [x] **T5.2** `_shared/marketingVideoCaptions.ts`: request parsing, size and duration caps, magic-byte sniff, Groq call, response normalisation (trim spaces, drop empty words, clamp times), credit cost from duration. Deno `_test.ts` for all pure parts with a mocked fetch.
- [x] **T5.3** Edge function `marketing-video-captions` (`config.toml` `verify_jwt = false` per repo convention, auth in code), `rateLimitGate`, typed errors with `upgradeHook` where a plan or credit limit applies.
- [x] **T5.4** Env and health: document `GROQ_API_KEY` as required for captions in `validation-and-env.md`; show caption availability in `/admin/health` integration status. _`GROQ_API_KEY` is listed with "Video auto captions" in the health env registry and the Groq probe._

### Phase 6: Auto captions UI (4 to 5 days)

- [x] **T6.1** `lib/video/v2/captions/`: source audio extraction (Mediabunny, used range only), `wordsToTimeline`, paging via `@remotion/captions`, split and re-spread helpers. Vitest for mapping, paging, split and edit. _Paging is in-house; `@remotion/captions` was not added (see Decisions)._
- [x] **T6.2** `CaptionItem` + captions track in types, parse, ops, limits; `CaptionClip` renderer with 6 caption looks including word highlight. _Four caption looks (Highlight, Clean, Outline, Box), not six._
- [x] **T6.3** Auto captions sheet (source, language, progress, errors, upgrade CTA) and the captions lane.
- [x] **T6.4** Edit captions list (proofread all lines), tap-to-edit a line on the preview, Style for all captions, Delete all (one undo step). _Edit from the list, the panel, or by tapping the caption on the preview (a second tap edits)._
- [x] **T6.5** Export and thumbnails include captions; the 60 s cap and caption item cap hold. _Captions render through the shared composition, so export and thumbnails include them. A real export is a manual check._

### Phase 7: QA, tests and docs (3 to 4 days, plus docs in every phase)

- [x] **T7.1** Playwright (`ui/e2e/features/marketing/video-editor/`): phone full-screen shell, tool strip navigation, add text with a look, trim view, separate sound, record voice (fake media stream via Chromium flags `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`), auto captions with a mocked `marketing-video-captions`, captions edit and delete all, export sheet. Desktop: rail Audio and Captions sections. Update existing selectors (`Clip actions`, `Editor actions`) in `videoEditorV2.spec.ts`. _Specs: phone shell, tool rows, trim drag, plus tile and helper pills, tap to edit, new text visible, overflow, 44 px targets, toast, landscape prompt, desktop rail and toolbar, record voice, auto captions. Plus DOM tests for the tool strip, chips, slider and inertExcept._
- [x] **T7.2** `mobile-responsive` gate at 375, 768 and 1024 px; `accessibility` pass (tool strip roles, focus return after panels, captions list labels, record button state announced). _Checked at 320, 375, 390, 768, 1024, 1440 and landscape. axe (WCAG A and AA) is clean on the phone editor after marking the composition images decorative._
- [ ] **T7.3** Manual matrix: export with voice, separated sound, captions and every text look on Chrome, Safari macOS, Safari iOS, Chrome Android, Firefox. _Manual matrix not run (needs Safari, Firefox, iOS, Android)._
- [ ] **T7.4** `property-dashboard-qa` pass on Marketing → Videos across plan tiers (captions gate, quota for recordings). _`property-dashboard-qa` not run._
- [x] **T7.5** Docs and help (§10); move this plan through `in-progress/` and `for-testing/` with the `workflow` skill. _Docs, route guide, FAQs and support checks done. Plan stays in `in-progress/` until the manual checks pass._

**Rough total:** 30 to 38 working days for one engineer. Phases 3 and 4 can run in parallel with Phase 5 once Phase 2 lands.

---

## 8. Must not break

| Area                                                  | Guard                                                                                                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Posts (Polotno) editor                                | Shared `MarketingEditor*` components change only additively; Posts E2E and screenshots at 375 px before and after.                                    |
| Templates, storyboard recipes, v1 migration           | Golden tests (`migrateVideoProjectV1.test.ts`) untouched and green; templates render the same (no new fields set by default).                         |
| AI video builder, guest-review seeding, planner seeds | `videoAiProjectBuilder`, `applyGuestReviewToVideoProjectV2`, `applyPlannerSeedToVideoProject` tests green; seeded text keeps its look.                |
| Autosave and history                                  | Recording and captions are single history steps; no blob URL is ever saved; `useVideoProjectHistory` shortcuts unchanged.                             |
| Export, thumbnails, publish                           | `exportVideoV2` preflight covers new media; `renderVideoProjectThumbnailV2` ignores audio and draws captions; Meta publish unchanged.                 |
| Limits and quotas                                     | 60 s cap, track and item caps, media quota (recordings count), server validator mirrors client.                                                       |
| Rollback flag                                         | `VITE_VIDEO_EDITOR_V2=false` still opens; projects with captions show a notice instead of breaking.                                                   |
| Bundle and PWA budget                                 | Recorder, captions and Mediabunny code are lazy chunks; `assert-lazy-mediabunny.mjs` and the precache budget stay green (see the Polotno chunk note). |
| Permissions                                           | Read-only roles see the editor without record, captions or edit tools (existing `canEditContent`).                                                    |

---

## 9. Plans, permissions, audit, security

- **Plans:** voice recordings use the existing `marketingMediaLibrary` quota (no new key). Auto captions are an AI feature: gated like other marketing AI (`canGenerate` and AI credits); whether Free gets a small allowance is open question Q3. Update `plans-feature-matrix.md` and the Compare row text if captions become a plan bullet.
- **Team RBAC:** record and separate sound need `marketing.media:add` (upload) plus content edit; captions need `marketing.content:edit`. No new permission leaves.
- **Activity log:** `activity-log: N/A` for transcription (no stored state; the result is saved through the normal autosave) and for voice uploads (same N/A as other media uploads).
- **Security and privacy:** audio is sent to Groq and not stored by us; add Groq speech-to-text to the subprocessor and privacy notes (open question Q4). Cap body size before buffering, sniff audio type, no PII in logs (ids only), rate limit per user, AI quota before the provider call.

---

## 10. Docs and help to update (same change as each phase)

- `docs/architecture/marketing-video-editor.md`: phone shell, tool tree, new item and track kinds, captions pipeline, voiceover, ducking.
- `docs/architecture/overview.md` + `docs/PROJECT.md`: new edge function `marketing-video-captions`, Groq speech use, `@remotion/captions`.
- `docs/architecture/validation-and-env.md`: `GROQ_API_KEY` now required for captions.
- `docs/guides/routes/org/property/marketing.md` (`route-guides`): Videos section rewritten for the phone flow, recording, captions, text looks; Host Q&A ("How do I add subtitles?", "Why can't I record?", "Do recordings use my storage?").
- `support-content`: `docs/guides/support/faqs.md` + Host-facing knowledge; run `check:support-content` and `check:ai-knowledge-coverage`.
- `plans-feature-matrix.md` if captions are plan-gated.
- `docs/workflow/in-progress/marketing-video-editor-multitrack.md` §11: point voiceover, captions and ducking to this plan.

---

## 11. Testing summary

- **Vitest:** `duckedVolume`, separate-sound op, `wordsToTimeline`, caption paging, split and re-spread, look parsing, caption limits, randomized ops invariants extended to the captions track.
- **Deno:** `marketingVideoCaptions_test.ts` (caps, sniff, normalisation, credit cost, error mapping with mocked Groq); server validator cases for new kinds.
- **Playwright:** §7 T7.1 (phone and desktop), fake microphone, mocked captions endpoint.
- **Manual:** export matrix, iOS recording, real captions quality on Taglish clips.

---

## 12. Open questions

1. **Q1 Dark editor on phone:** dark surface for the phone editor (recommended; every phone video editor does this), or follow the app theme?
2. **Q2 Full screen on phone:** hide the dashboard header and bottom tabs while editing (recommended), or keep them?
3. **Q3 Captions on Free:** a small trial allowance via AI credits (recommended), or paid tiers only?
4. **Q4 Groq for speech:** acceptable as a subprocessor for host voice audio (no storage on our side)? If not, the fallback is OpenAI `whisper-1` with the same word timestamps at a higher price.
5. **Q5 Caption languages:** Auto, English and Filipino at launch (recommended); more later.

## 13. Out of scope

Stickers and GIF library, effects and filters packs, keyframes, masks, chroma key, beat sync, caption translation, AI voice (text to speech) narration, noise removal, multi-take voice comping, server-side rendering, projects longer than 60 s.

## Sources

- OpenCut: [github.com/OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut) · OpenReel: [github.com/Augani/openreel-video](https://github.com/Augani/openreel-video) · FreeCut: [github.com/fengmk2/freecut](https://github.com/fengmk2/freecut) · Twick: [github.com/awch-D/Twick](https://github.com/awch-D/Twick) · DesignCombo: [github.com/designcombo/react-video-editor](https://github.com/designcombo/react-video-editor)
- Groq speech to text and word timestamps: [console.groq.com/docs/speech-to-text](https://console.groq.com/docs/speech-to-text), [groq.com/build-fast-with-word-level-timestamping](https://groq.com/build-fast-with-word-level-timestamping/), pricing [groq.com/pricing](https://groq.com/pricing)
- Remotion captions: [remotion.dev/docs/captions/create-tiktok-style-captions](https://remotion.dev/docs/captions/create-tiktok-style-captions), [remotion.dev/docs/captions/displaying](https://www.remotion.dev/docs/captions/displaying), Editor Starter captioning [remotion.dev/docs/editor-starter/captioning](https://www.remotion.dev/docs/editor-starter/captioning)

---

## 14. Decisions

| Decision                          | Choice                                                                                                                                                                          | Why                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Q1 Dark phone editor              | Yes, dark surface for the phone editor only                                                                                                                                     | Video colours read true; matches every phone editor                                                                        |
| Q2 Hide dashboard chrome on phone | Yes, via a full-screen editor layer (`fixed inset-0 z-[45]`, below sheets at `z-50`)                                                                                            | No change to `AdminLayout`; the shell heights were the real cause of the small preview                                     |
| Q3 Captions plan gate             | No new plan key. Gated by `marketing.content:edit` plus the AI feature toggle and AI credit quota                                                                               | Every tier already has AI allowance; avoids a catalog migration and the plan-tier golden churn                             |
| Q4 Groq as speech subprocessor    | Accepted, audio not stored; documented in `validation-and-env.md` and the route guide                                                                                           | Already the platform LLM fallback provider                                                                                 |
| Q5 Caption languages              | Auto, English, Filipino                                                                                                                                                         | Matches host base                                                                                                          |
| Spike T0.2 recorder format        | Record with `MediaRecorder` in the browser default type, convert to M4A with Mediabunny before upload; if conversion is unsupported, upload the original (WebM/Opus or MP4/AAC) | Library already accepts `audio/webm`, `audio/mp4`; export plays both on Chromium                                           |
| Spike T0.3 text effects           | Stroke via `-webkit-text-stroke` + `paint-order`, shadow via `text-shadow`, box via background; each look declares a plain fallback (no stroke or glow)                         | Web renderer supports CSS text properties; fallback keeps export working if a property is dropped                          |
| Spike T0.4 sound from a video     | Separate sound is an `AudioItem` that points at the same video URL (`@remotion/media` `<Audio>` accepts it); the source clip is muted                                           | No re-upload, no extra quota                                                                                               |
| Spike T0.5 captions source        | Client sends the used range as a small mono audio blob to `marketing-video-captions`; Groq `whisper-large-v3-turbo` word timestamps                                             | Keeps the 25 MB Groq limit far away (60 s is about 0.5 MB)                                                                 |
| Caption items vs `maxItems`       | Captions do not count toward the 150 item cap; own cap of 200                                                                                                                   | A 60 s narration is about 40 lines; counting them would block normal projects                                              |
| Rollback editor with captions     | Rollback editor ignores caption items and shows a notice                                                                                                                        | v1 UI is deleted next release (multitrack T6.6)                                                                            |
| Captions gate (Q3, revised)       | `marketing.generate:add` plus plan feature `aiMarketingGeneration`, like every other Marketing AI action; no new plan key                                                       | Matches `generate-marketing-caption`; the audit found `marketing.content:edit` was not how Marketing AI is gated           |
| Caption paging                    | In-house `pageWords` (pure, tested); `@remotion/captions` not added                                                                                                             | About 30 lines, no new dependency or bundle weight                                                                         |
| Caption audio                     | One mono 16 kHz WAV of the whole video in project time, one provider call                                                                                                       | Words come back in project time with no conversion; 60 s is 1.92 MB, under the 2 MiB cap; sped up clips are resampled      |
| Voice clip timing                 | The clip is added only after the upload finishes                                                                                                                                | No blob URL is ever in the project; the server validator rejects `blob:`                                                   |
| Server validation (T5.0)          | Size, structure, counts, 60 s, caption limits and blocked URL schemes; no host allowlist                                                                                        | Saved projects hold URLs from several hosts; rejecting one would break autosave, and prod data cannot be audited from here |
| Provider transport                | `_shared/ai/speechTransport.ts`                                                                                                                                                 | `check:ai-gateway` requires provider hosts under `_shared/ai/`                                                             |
| Trim view                         | Poster tiled across the bar, seconds shown live, applied once on finger lift                                                                                                    | No frame filmstrip exists in the timeline; one undo step per trim                                                          |
| Edit panels on phone              | Docked above the strip, at most 40% of the height                                                                                                                               | The old Edit sheet covered the preview; the Style panel first built hid it too, so details moved behind "More options"     |
| Sheets on the phone editor        | Dark, like the editor: the whole session adds `dark` to `html`                                                                                                                  | Sheets portal outside the dark layer and looked like a different app                                                       |
| Toasts on the phone editor        | Placed just below the top bar, and kept tappable (only the rest of the app is `inert`, via `inertExcept`)                                                                       | A top toast covered Export, and an inert app root made toast actions (Undo, Add more) untappable                           |
| Slider values on the phone        | No number boxes (`PanelSlider`)                                                                                                                                                 | Typing digits on a phone is hard; the value shows beside the label                                                         |
| Landscape phone                   | A "Turn your phone upright" prompt with Keep editing                                                                                                                            | There is no room for preview, timeline and tools; the preview collapsed to a sliver                                        |
| Short phones (320 x 568)          | The preview and timeline shrink first so the tool strip never leaves the screen                                                                                                 | The strip was pushed off-screen when a panel opened                                                                        |
| Adding several photos             | The sheet still closes after a pick; the Added toast has an Add more action (7 s)                                                                                               | Keeps the sheet flow simple and tests stable                                                                               |
| Captions with an unreadable clip  | The mixer skips a clip it cannot decode and only fails when nothing could be read                                                                                               | One broken clip should not stop captions made from the others                                                              |

## 15. Acceptance per phase

| Phase | Proof                                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `bun run type-check`, `bun run lint`, Vitest for the shell hook, Playwright phone spec shows no dashboard header or tab bar while editing, preview at least 40% of the height |
| 2     | Vitest for tool tree and context tools, Playwright `Clip actions` and tool strip flows green at 375 px                                                                        |
| 3     | Vitest: every `TEXT_LOOKS` entry parses and round-trips through `parseVideoProjectV2`; templates render unchanged (existing golden tests green)                               |
| 4     | Vitest: `duckedVolume`, `separateSound`, recorder offset math; Playwright with a fake microphone                                                                              |
| 5     | `bun run test:edge` for `marketingVideoCaptions_test.ts` and `marketingVideoProject_test.ts`                                                                                  |
| 6     | Vitest: `wordsToTimeline`, paging, split, re-spread, caption ops invariants; Playwright with a mocked captions endpoint                                                       |
| 7     | `bun run ci:quality`, route guide and support content checks green                                                                                                            |

## 16. Edge cases

Mic blocked or missing; mic in use; recording interrupted by a phone call or tab hidden (stop and keep the take); recording past the 60 s cap (stop at the cap); no speech found (friendly error, nothing added); caption request over AI quota or AI disabled (clear message); read-only role (no record, no captions, no edit); source clip later deleted or trimmed after captions exist (captions stay editable text, `sourceItemId` may dangle and is ignored); undo after recording or captions (one history step each); blob URL never saved (autosave waits for the library URL); offline (recording works, upload and captions queue or fail with retry); caption text over 200 characters (clamped); caption count over the cap (stops with a notice).

## 17. Rollback

Each phase is additive. `VITE_VIDEO_EDITOR_V2=false` still opens the old editor. New item and track kinds are optional fields, so reverting the UI leaves saved projects readable. The new edge function can be disabled with the `marketing_video_captions` AI feature toggle without a deploy.
