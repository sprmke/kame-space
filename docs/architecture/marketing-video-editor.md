# Marketing video editor (multi-track) and media library

Videos tab of Marketing Studio. Replaces the scene slideshow with a CapCut-style timeline: photos, video, text and audio each sit on their own track. Hosts upload media to a per-property library with plan quotas. Plans and history: [`../workflow/in-progress/marketing-video-editor-multitrack.md`](../workflow/in-progress/marketing-video-editor-multitrack.md) (tracks, library, quotas) and [`../workflow/in-progress/marketing-video-editor-mobile-first-refine.md`](../workflow/in-progress/marketing-video-editor-mobile-first-refine.md) (phone-first editor, text looks, voiceover, auto captions).

## Rollout and flags

| Flag                        | Effect                                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_VIDEO_EDITOR_V2`      | On unless set to `false`. `false` opens the old scene editor (rollback, kept one release). Saved projects are data: v1 rows open in either editor (v2 upgrades them on open). |
| `VITE_REMOTION_LICENSE_KEY` | `free-license` (3 people or fewer) or a company key, passed to `renderMediaOnWeb`. Unset logs Remotion's licence reminder. Open decision T0.1.                                |

The loader (`marketingEditorPreload.ts`) picks the editor, so hover-preload warms the right chunk.

## Project model v2

`ui/src/features/dashboard/marketing/lib/video/v2/`

- `videoProjectV2Types.ts`: `VideoProjectV2 { version: 2, tracks[] }`. `tracks[0]` is the single **main** track; others are `overlay`, `text`, `audio`. Order is bottom to top and is the render order (the web renderer ignores z-index).
- Items: `MediaItem` (image or video), `LayerItem` (text, CTA, slots, logo; same payload as v1 layers so templates look identical), `AudioItem` (optional `role`: `music`, `voice`, `sound`; `duckUnderVoice`; `sourceItemId` when separated from a video) and `CaptionItem` (a subtitle line: `text` plus timed `words`). A single `captions` track holds the lines and one `CaptionStyle` (look, height, size) for all of them. Every addition is an optional field or a new kind, so old rows parse unchanged and no data migration ran.
- **Main track is magnetic**: contiguous from frame 0; insert, move, delete and trim ripple later clips; `transitionIn` overlaps the previous clip. Free tracks never overlap; a clash makes a new track.
- Limits (`VIDEO_V2_LIMITS`, mirrored server-side in `_shared/marketingVideoProject.ts` and enforced by `marketing-templates` on every video save): 60 s, 10 tracks, 150 clips, 200 caption lines (counted separately, `countItems` skips the captions track), 3 visible videos, `design_json` 512 KB. The server also rejects `data:`, `blob:`, `javascript:` and `file:` URLs anywhere in a saved project. A host allowlist is a follow-up: saved projects hold property photos, logos, AI results, library files and free-music streams, and rejecting a legitimate save would break autosave.
- `timelineOps.ts` holds every edit as a pure function returning `OpResult` (`ok`, `reason`, `clamped`, `itemIds`). `timelineTiming.ts` derives time and active items. `timelineDrag.ts` / `timelineScale.ts` are drag and zoom math. All have Vitest coverage (randomized invariant tests for ops).
- `editorCommands.ts` builds items from library payloads, text presets, duplicate and clipboard helpers. `canvasPatch.ts` applies canvas drags. `shortcuts.ts` maps keys to commands.

### v1 to v2

`migrateVideoProjectV1` is lossless for timing. `parseVideoProjectV2` accepts either version; v1 rows migrate on load and autosave writes v2. Known difference: v1 `sceneStartFrame` drifted after the second transition; v2 uses the correct cumulative math. Migrated text ends where the next transition begins and fades over 6 frames.

Default music: a v1 template's music cue has no file until the editor resolves the Joystock track. `projectLoad.ts` returns it as `pendingMusic`; `useResolveDefaultVideoMusic` resolves it and `withResolvedMusic` adds the looping `music` audio clip (a later cached copy only updates it if the clip still exists).

AI-built videos are saved as v1 scene projects and upgrade on open. The builder draws scene media from the host's recent uploads first (`aiLibraryMedia.ts`), then the property gallery.

## Composition and export

- `VideoCompositionV2.tsx`: `TransitionSeries` for main, `Sequence` per other item, `Video`/`Audio` from `@remotion/media` (the only ones the web renderer supports). Contain fit uses a blurred backdrop. A missing file shows a striped placeholder; during export `strictMedia` makes it fail instead.
- `exportVideoV2.ts`: blockers (empty, over 60 s) → `canRenderMediaOnWeb` → reachability probe of every media URL (`exportPreflight.ts`) → `renderMediaOnWeb` with an `AbortSignal` (Cancel) and progress. Muted when nothing can make sound (`projectHasAudio`). Jamendo and Audius stream clips are cached to Storage first (`cacheCatalogAudioForExport` in `exportAudio.ts`, server action `import-track`); a clip that cannot be cached is dropped from the export with a notice. An Instagram song (`project.instagramSong`) is never rendered.
- Verified in Chromium only. Safari and Firefox need a manual matrix. `maxCanvasSinkFrameSize` is not exposed by the installed `@remotion/media`, so preview decode load is limited by the 3-visible-videos warning and `premountFor`.
- Thumbnails: `renderVideoProjectThumbnailV2` (audio tracks dropped) renders a still at 60% into the first main-track clip; the Library card and template stills use it for v2 rows, the v1 renderer for legacy ones.

## Phone editor (`max-lg`)

A full-screen dark editor layer: `MarketingStudioShell` `fullscreen` portals to `body` at `z-[45]` (above the app tab bar and quick-access button, below sheets and dialogs at `z-100+`), makes `#root` `inert` and locks page scroll while it is open. Desktop is unchanged. Layout, top to bottom: top bar (Back, name, save status, Undo, Redo, **Export**), preview (takes the free height), transport, timeline, then a docked panel and the **tool strip** in the page flow, so nothing floats over the timeline.

- `lib/video/v2/phoneTools.ts` is the pure tool tree: root tools (Audio, Text, Captions, Media, Templates, Size, Background, AI, More), second-level rows, and the row for each selection kind (`selectionKind`, `toolsForSelection`). `PhoneToolOptions` switches voice, sound tools, captions and AI on and off.
- `components/video-editor/v2/mobile/`: `VideoToolStrip`, `VideoClipPanel` (Speed, Volume, Fade, Duration, Fit, Motion, Adjust, Animation, Edit, Style, Lower for voice), `VideoTrimPanel` (whole file on one bar, two handles, applies on finger lift as one undo step through `setSourceWindow`), `VideoRecordPanel`, `VideoExportSheet`.
- Export (Download MP4 and Publish) lives in one sheet; zoom is gesture-only; the overflow menu is gone.

## Text looks

`lib/video/v2/textLooks.ts`: 12 one-tap looks as data over `VideoLayerTypography` (stroke, shadow, `boxColor`, `boxRadius`, `glowColor`, font, case). `applyTextLook` clears the previous look's keys first (`LOOK_KEYS`), `detectTextLook` reads which look a layer has (`null` after hand edits), accent looks take the project's campaign palette. `typographyToCss` draws the box and glow. Presets (`TEXT_PRESETS`) carry a starting look. Preview and export use the same CSS path.

## Music picker and Instagram songs

- Sources: Jamendo and Audius (full tracks, baked into the export) and Instagram's Reels music (Meta adds it on publish). One `MusicTrack` shape (`source`, `exportable`); the server merges and interleaves (`_shared/musicCatalog.ts`), groups come from `_shared/musicGroups.ts` and are mirrored in `lib/music/musicTypes.ts` (parity test).
- `AudioItem.media.source` accepts `audius`. Stable Audius URLs (`api.audius.co/v1/tracks/{id}/stream`) are saved, never the signed ones, and are cached to Storage before export like Jamendo's.
- `VideoProjectV2.instagramSong?: InstagramSong` is project level, not a clip: Instagram's `audio_configuration` has no start offset and Meta does not preview the mix, so a timeline clip would promise what publish cannot do. It parses with clamped numbers and https-only art. Preview links expire in about a day and a half, so only the id is saved and each play fetches a fresh link.
- Publish: `publish-to-meta` accepts `instagramAudio { audioId, audioVolume }` for `instagram_reel` video posts that are not scheduled. The dialog starts on Instagram + Reel when a song is set.
- Default music resolution and the older scene editor ask for `only=jamendo` so they never see Audius ids.

## Audio, voiceover and music lowering

- `audioDucking.ts`: `audioRoleOf`, `voiceRangesOf`, `duckFactor` (music at 25% under voice, 0.3 s ramp). `VideoCompositionV2` multiplies it into each music clip's volume (preview and export agree).
- `separateSound` (a `timelineOps` op, 1x only) copies a video's sound to an audio clip in step and mutes the video. **Sound from video** adds a library video's sound as a `sound` clip.
- Voice recording: `hooks/useVoiceRecorder.ts` (`MediaRecorder`, level meter, stops on end, cap or hidden tab), `voicePlacement.ts` (start offset between recorder and player, 60 s cap). The take uploads through the normal media library queue and becomes a clip only after the upload finishes, so no temporary URL is ever saved. Files are uploaded as recorded (M4A where supported, else WebM Opus); transcoding to M4A is not done.

## Auto captions

Browser: `lib/video/v2/captions/` builds one mono 16 kHz WAV of the video's speech in project time (`captionAudio.ts` picks voice and video-sound clips, mixes, resamples, encodes; `captionAudioBrowser.ts` decodes only the played part of each clip with Mediabunny, lazy), calls the edge function (`captionApi.ts`), pages words into lines (`captionPaging.ts`, in-house; `@remotion/captions` was not added) and places them (`captionItems.ts`, `captionOps.ts` replace or delete the whole track in one undo step). `captionLines.ts` edits and splits lines without losing words. `CaptionClipV2` renders a line from the track's `CaptionStyle` and highlights the spoken word.

Server: `marketing-video-captions` takes the WAV (2 MiB cap, `Content-Length` checked before reading, magic-byte sniff), checks `marketing.generate:add` plus plan feature `aiMarketingGeneration`, the `marketing_video_captions` AI feature toggle and `assertOrgAndPropertyAiQuota`, calls Groq Whisper (`whisper-large-v3-turbo`, `verbose_json`, word timestamps) through `_shared/ai/speechTransport.ts` (the AI gateway directory), records usage by audio length (about $0.04 per hour, 10 s minimum) and stores nothing. Needs `GROQ_API_KEY`. Provider errors are never forwarded to the host.

## Editor UI

`components/video-editor/VideoEditorV2.tsx` with `v2/` pieces: preview with canvas overlay (move, resize, rotate, snap, safe-area guide), timeline, inspectors, transport, export dialog.

- Desktop timeline: ruler, zoom, track headers (hide, mute, lock), drag, trim, snap, split, copy and paste, marquee. Shortcuts: Space, S, Delete, Shift+Delete (ripple), Cmd/Ctrl+D, C, V, A, Z, arrows (Shift = 1 s). A focused slider does not swallow them.
- Phone (`max-lg`): see [Phone editor](#phone-editor-max-lg). Timeline: fixed centre playhead, scrolling the lanes scrubs, pinch zooms, long-press (320 ms) arms a clip drag, 44 px trim handles.
- Left rail: Media (library), Audio (record voice, sound from a video), Text (visual preset grid), Templates, Reviews, Captions, AI. The Media panel starts open only at 1536 px and wider. Replace opens the library filtered to the clip's kind.
- Autosave only; there is no manual Save, so no unsaved-changes guard applies.

## Media library

Bucket `marketing-media` (public, 150 MiB, MIME allowlist, no SVG). Table `marketing_media_assets`; quota and reserve RPCs; `marketing-media` edge function (list, usage, used-in, reserve, finalize, abandon, delete, restore); `marketing-media-sweeper` cron. Bytes go straight to Storage over signed upload URLs; the function only reserves and finalizes. Details: [`storage.md`](storage.md), [`edge-functions.md`](edge-functions.md), [`data-model.md`](data-model.md).

Client (`lib/media/`): sniff, probe, local limit check, image optimize, video re-encode to H.264 1080p when needed (Mediabunny, lazy), poster, audio peaks, chunked SHA-256, upload queue (2 at a time, 3 retries, cancel). TUS resumable is not possible with signed upload URLs, so uploads are a single PUT; hosted Supabase needs its global file size limit at 150 MB or more (Free plan caps at 50 MB).

Quota per property comes from the plan feature `marketingMediaLibrary` (see [`plans-feature-matrix.md`](plans-feature-matrix.md)). Nothing is deleted on downgrade; over quota only blocks new uploads. Deleting asks first and shows how many saved designs use the file (`used-in`); delete is soft for 7 days with Undo.

Team RBAC: `marketing.media:add` (reserve / finalize / abandon) and `marketing.media:delete` (delete / restore), split out of `marketing.content:add` / `:edit` by `20261318140000_marketing_media_permissions.sql`.

Only the Videos rail reads this library today. The Posts (Polotno) Upload panel and the `marketing-music` upload still use `upload-marketing-asset` against `property-media`, and `marketing-templates` does not yet validate a v2 project on save; those three integrations are open tasks T2.7, T1.11 and T1.13 in the plan.

`marketing-templates` saves stamp `last_used_at` on referenced assets (best effort, for a future retention policy). Activity: `marketing.media_deleted`, `marketing.media_restored`; uploads and the `last_used_at` stamp are `activity-log: N/A` (high-volume bookkeeping).

## Super-admin

`/admin` overview shows total media storage; the org hub shows storage per property (`get-organization-admin`, `super-admin-overview`). Plan limits are edited in the pricing plan dialog.

## Tests

Vitest for all pure modules; Deno for the edge helpers; live local `functions/tests/marketingMedia.integration_test.ts` (`LOCAL_MEDIA_LIVE=1`); Playwright `ui/e2e/features/marketing/video-editor/` (desktop and phone). CI asserts Mediabunny stays lazy (`scripts/media/assert-lazy-mediabunny.mjs`).
