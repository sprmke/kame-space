# Kame talking prototype

Review checkpoint for the approved soft-green turtle with orange shell. This
standalone preview tests whether layered, rendered artwork can preserve the
chosen appearance while supporting speech and small gestures. It is not wired
into the application or the live receptionist.

## Run

From this directory:

```sh
python3 -m http.server 4318 --bind 127.0.0.1
```

Open <http://127.0.0.1:4318>. Select **Play greeting**. The large view and the
160 px receptionist view share the same frame. Background controls show white,
mint, dark teal, and an alpha checkerboard. Native audio controls allow seeking;
the custom controls support pause/resume and replay. Reduced-motion preference
disables blinking and body/hand movement while retaining speech articulation.

## What is implemented

- Approved rendered artwork, with a generated clean facial plate and nine
  generated mouth overlays. Original rendered eye patches are feathered into
  the plate; no new geometric turtle model is used.
- Rhubarb-generated mouth cues follow the audio element's playback position.
  Short crossfades soften cue boundaries. This is audio-derived timing, not
  random mouth movement or an amplitude-only animation.
- Local texture deformation adds a greeting wave followed by conversational hand gestures,
  movement in the other arm, speech-emphasis nods, head inclination, and breathing. Feet and contact shadow remain anchored. This is 2.5D artwork,
  not a skeletal 3D rig, and it cannot produce arbitrary turns.
- Actual alpha transparency, including the contact shadow. The WebM export
  contains a VP9 alpha plane; MP4 uses a pale mint background. WebM alpha support
  must be checked on deployment browsers, especially Safari; canvas/PNG alpha
  is the preview's primary path.
- A 6.66-second sample recorded with the macOS Samantha voice. This voice is
  only for a local review and does not replace the receptionist voice.

## Assets and provenance

| File                        | Purpose                                                                   |
| --------------------------- | ------------------------------------------------------------------------- |
| `assets/welcome.png`        | Approved-style transparent welcome pose from the image-generation session |
| `assets/face-base.png`      | Same framing, eyes and mouth removed for facial compositing               |
| `assets/mouth-atlas.png`    | 3×3 transparent rendered mouth atlas; row-major X, A, B, C, D, E, F, G, H |
| `assets/greeting.wav`       | Local sample voice, mono PCM at 16 kHz                                    |
| `assets/greeting.txt`       | Exact sample transcript supplied to the recognizer                        |
| `assets/greeting-cues.json` | Rhubarb 1.14.0 mouth-shape timings                                        |

Images were created with the built-in imagegen tool. The final approved
two-view reference used an orange-on-orange recessed four-quadrant logo on the
shell and original oval crown spots. This fixed front view does not expose the
back engraving. No paid video generation was used.

Generation instructions: preserve the approved character's shape, pose, camera,
colors, and translucent ground shadow; remove only eyes and mouth for the base.
The mouth atlas uses nine equally spaced transparent cells with dark brown
edges and shaded interiors, coral tongues, no skin patches, and no labels.
Prompts and review references are in `generation.json`.

## Reproduce speech and export

Install [Rhubarb Lip Sync 1.14.0](https://github.com/DanielSWolf/rhubarb-lip-sync/releases/tag/v1.14.0)
locally. Do not commit its binaries. Rhubarb is MIT licensed and its generated
timing data belongs to the user; see its [license](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/master/LICENSE.md).

```sh
say -v Samantha -r 165 -f assets/greeting.txt -o /tmp/kame-greeting.aiff
ffmpeg -i /tmp/kame-greeting.aiff -ar 16000 -ac 1 assets/greeting.wav
rhubarb -f json -d assets/greeting.txt -o assets/greeting-cues.json assets/greeting.wav
```

Normalize `metadata.soundFile` to `greeting.wav` before committing cues, so local
filesystem paths are not recorded. The greeting pronunciation is that of the
installed system voice; brand pronunciation needs a separate voice review.

With the preview server running, Playwright installed via the repository's
dependencies, and FFmpeg available:

```sh
node exportPreview.mjs /absolute/path/to/output http://127.0.0.1:4318
```

The exporter verifies viewport overflow, playback/pause, reduced motion, alpha,
and page errors. It renders deterministic frames at 60 fps, then writes a
background-composited MP4, transparent WebM, screenshots, and verification JSON.
The default output is under `marketing/.artifacts/mascot-preview` (gitignored).

## Boundaries for the next iteration

This is a visual and timing review, not validated production lip sync. The mouth
shapes are broad sound groups rather than an exact articulatory simulation;
F/V and tongue poses are stylized, and automatic cues may need corrections.
Blinking uses compressed original eye layers rather than a sculpted eyelid rig.
The wave is a small local texture deformation rather than a full arm rotation.
Review these at 160 px before expanding the action library.

The current receptionist receives streamed PCM audio and text transcripts in
`ui/src/features/guest/chat/hooks/useVoiceSession.ts`; its playback clock lives
in `voicePlaybackQueue.ts`. A live version needs a streaming mouth-cue provider,
latency measurements, and synchronization with that clock. It must clear queued
cues immediately on interruption. This recorded-file prototype does not solve
those live-stream requirements. Rhubarb's file-based analysis is suitable for
the sample and is not assumed to run in a guest browser.

## Scope checklist

Validation on this review branch: deterministic 60 fps export completed (442
frames, all nine mouth shapes), playback/pause and reduced-motion checks passed,
and no browser page errors or horizontal overflow occurred at the five tested
widths. Decoding the WebM alpha plane confirmed fully transparent pixels and
partial-alpha pixels. The repository quality gate passed frontend type-check,
lint, unit tests and coverage, and edge type-check; it stopped in `test:edge`
because Deno could not resolve `npm:@types/node` in the isolated checkout.
Later stages of that gate were not run.

- Documentation maintenance: this README describes the prototype and limits.
- Route guides, support content, skeletons, save guards: not applicable; no app
  route, user flow, data mutation, form, or live feature is changed.
- Mobile review: 375, 390, 768, 1024, and 1440 px; controls are at least 44 px.
- Activity log, plans, and permissions: not applicable to this local media study.
- Merge remains a separate decision after visual review.

## Motion study 02

The performance now continues throughout the greeting. The first hand wave eases
in and out with zero-speed envelope boundaries, followed by smaller explanatory
gestures. Head nods emphasize three beats in this recorded sample; those beats
are authored for this greeting, not inferred from arbitrary conversation.
The second arm and torso move subtly while feet and shadow stay anchored.
Blink closing and reopening use eased, asymmetric timing with an occasional
double blink. Mouth transitions use eased crossfades capped by each cue duration.
The browser renders on requestAnimationFrame; exports use 60 fps. The gesture
strength slider ranges from 0.6 to 1.5. Idle movement continues before and after
the greeting, while pausing mid-sentence freezes the pose.

This remains local texture deformation of fixed-angle rendered artwork. Large
rotations, hands crossing the face, and new silhouettes require additional
artwork or a proper character rig. These limits prevent overextending the image
and distorting the approved character.
