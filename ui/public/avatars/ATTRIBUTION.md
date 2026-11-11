# Avatar attribution

## `ui/public/avatars/receptionist-turtle-talk.mp4`

Full 9:16 clip. Used by the host tour film (`SceneGuests.tsx`).

- Source art: user-provided cute turtle illustration.
- Motion: HeyGen full-body portrait clip (720×1280, 9:16), trimmed and spliced (excludes ~2.6–4s goofy eye-roll), audio-stripped.
- Idle still: `receptionist-turtle-idle.webp` (last outro frame — neutral closed-smile pose).
- Mouth motion follows the HeyGen bake, not live Gemini phonemes.

## Legacy square video assets

- Legacy square avatar loop and poster derived from the talk clip above; retained for reference but no longer used by the live booth.
- 320×320 square crop (head to belly, the same framing the booth used before), 25 fps, H.264, keyframe every second, no audio.
- Boomerang loop: source 2.0 to 7.0 s played forward then reversed, so the first and last frames match and native `loop` never jumps.
- The host tour uses the portrait clip and its still image.
- Regenerate:
  `ffmpeg -i receptionist-turtle-talk.mp4 -filter_complex "[0:v]trim=start=2.0:end=7.0,setpts=PTS-STARTPTS,crop=600:600:60:264,scale=320:320:flags=lanczos,format=yuv420p,split[f][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[f][r]concat=n=2:v=1[out]" -map "[out]" -an -c:v libx264 -profile:v main -preset slow -crf 27 -g 25 -keyint_min 25 -sc_threshold 0 -movflags +faststart -r 25 receptionist-turtle-loop.mp4`

## Legacy

- `receptionist-portrait.png` — previous photoreal portrait (kept as image-load fallback path unused by default).

## Live guest receptionist booth

- `ReceptionistAvatar` renders the selected A1-inspired design through the shared Kame v6 Three.js rig in `marketing/social/src/mascot/Kame.tsx`.
- Speech animation follows the live output audio level (`--voice-out`); call states drive greeting, listening, thinking, and error poses.
