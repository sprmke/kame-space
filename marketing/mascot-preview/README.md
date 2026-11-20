# Kame motion study 04

Standalone review prototype for the approved soft-green turtle with an orange
shell. It tests a fixed-camera layered character rig with eight selectable
actions. It does not replace the live receptionist or any application route.

## Preview

From this directory:

```sh
python3 -m http.server 4318 --bind 127.0.0.1
```

Open <http://127.0.0.1:4318/?study=4>. Select a gesture or **Play all**.
**Pause motion** freezes the gesture and blink clock. **Play greeting** runs the
recorded voice and a wave. Gestures can also be selected while speech plays;
mouth cues continue to follow the audio clock independently. Audio and motion
have separate pause controls. Each action returns to idle after its duration.

| Action    | Duration  | Motion                                         |
| --------- | --------- | ---------------------------------------------- |
| Idle      | 4 s cycle | Gentle torso movement and head inclination     |
| Wave      | 3.6 s     | Arm lifts, waves, and lowers                   |
| Laugh     | 3.2 s     | Small body/head bounces, squint, open smile    |
| Think     | 5 s       | Hand approaches the chin with a head tilt      |
| Sit down  | 6 s       | Torso lowers, hips rotate outward, then stands |
| Jump      | 2.8 s     | Anticipation, lift, landing, and settling      |
| Listen    | 4.2 s     | Attentive tilt with small nod-like movement    |
| Celebrate | 4 s       | Both arms lift with light body movement        |

The large and 160 px receptionist views share one frame. Light, mint, dark, and
checkerboard backgrounds expose alpha edges. Reduced motion keeps the resting
pose and disables blinking, while audio-driven mouth shapes remain available.

## Why this approach

Study 02 applied spatial texture deformation to one flattened image. Masks
crossed the cheek and shoulder, so increasing gesture strength visibly warped
the character. Study 03 removed that distortion but left the body stationary.

Study 04 separates the head, torso, arms, and legs. Animation applies only rigid
rotation and translation to those layers. There is no texture-warp shader,
animated character scaling, shear, optical-flow interpolation, or crossfade
between full character images. The head, eyes, cheeks, crown spots, and mouth
move together. The ground shadow stays on the floor during jumps.

Every action starts and ends at the same joint pose with eased boundaries.
Selecting another action mid-movement samples the current pose, eases back to
rest over 450 ms, then starts the new action. Rapid clicks replace the pending
action without accumulating a queue. Strength is bounded at 0.6–1.5; it affects
expressive accents, not the required sitting or jumping geometry.

The approved artwork guides the generated cutouts and limbs; this is not a
claim of identical pixels for newly exposed surfaces. The face retains the
approved design and original eye patches. New hidden torso/limb surfaces need
visual approval. This front view does not expose the engraved shell logo.

## Assets and code

| File                        | Purpose                                                                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `assets/welcome.png`        | Original approved-style rendered reference and eye source               |
| `assets/head-layer.png`     | Isolated blank head, with cheeks and crown spots                        |
| `assets/torso-layer.png`    | Torso/shell cutout with hidden areas reconstructed                      |
| `assets/body-parts.png`     | Transparent six-cell atlas; the two arms and legs are used              |
| `assets/mouth-atlas.png`    | Nine rendered mouth overlays, X/A/B/C/D/E/F/G/H                         |
| `assets/greeting.wav`       | Local macOS Samantha sample voice, 6.66 seconds                         |
| `assets/greeting-cues.json` | Rhubarb 1.14.0 audio-derived mouth timing                               |
| `motion.mjs`                | Pure joint poses, easing, action durations, interruption controller     |
| `rig.js`                    | Layer extraction, shoulder overlap, rigid rendering and floor shadow    |
| `preview.js`                | Playback, expression composition, controls and deterministic review API |

The atlas torso and bent arm are unused: dedicated torso artwork and a complete
rotating arm gave better consistency. Earlier face/arm repair plates remain as
provenance for previous studies. Images use the built-in image-generation tool;
no paid video-generation service or new runtime dependency was used. Prompts
and source identifiers are recorded in `generation.json`.

The mouth follows broad audio-derived sound groups, with eased crossfades.
Blinking compresses the isolated eye patches; it is not a sculpted eyelid rig.
Laughing is visual only, with no generated laugh audio. During speech, speech
mouth cues take precedence over the open laugh expression.

## Verification and export

With repository Playwright dependencies and local FFmpeg available:

```sh
node --test motion.test.mjs
node exportPreview.mjs /absolute/path/to/output http://127.0.0.1:4318
node exportGestures.mjs /absolute/path/to/output http://127.0.0.1:4318
```

Unit tests sample all actions at 120 Hz and several strengths, checking finite,
bounded joint changes, neutral endpoints, continuous hip motion, jump landing,
and interruption continuity. Browser verification checks the actual drawing
transforms for stretching/shearing across all eight actions at maximum strength,
plus action controls, rapid switching, motion pause, speech playback/pause,
reduced motion, alpha, browser errors, and widths 375/390/768/1024/1440 px.

`exportPreview.mjs` renders the greeting at 60 fps and writes MP4, transparent
VP9 WebM, gesture snapshots and verification JSON. `exportGestures.mjs` renders
all eight complete actions into a silent 60 fps MP4, with chapter times in JSON.
These exports are reproducible samples; the browser rig provides interactive
transitions rather than playing pre-baked clips.

To regenerate speech timing locally:

```sh
say -v Samantha -r 165 -f assets/greeting.txt -o /tmp/kame-greeting.aiff
ffmpeg -i /tmp/kame-greeting.aiff -ar 16000 -ac 1 assets/greeting.wav
rhubarb -f json -d assets/greeting.txt -o assets/greeting-cues.json assets/greeting.wav
```

Normalize the cue metadata path to `greeting.wav` before committing.
[Rhubarb](https://github.com/DanielSWolf/rhubarb-lip-sync) is MIT licensed.
WebM alpha needs deployment-browser testing; Canvas/PNG alpha is the primary
review path. The sample voice does not replace the receptionist's voice.

## Production boundary

This is a fixed-angle 2.5D puppet, not a completed 3D character. Rigid sprites
avoid rubber-like distortion but cannot provide changing perspective, moving
3D lighting, hidden-side detail, physically articulated elbows, or arbitrary
shell turns. Sitting is a stylized hip rotation, not a newly simulated 3D pose.
The numerical checks do not certify visual quality; review the full gestures.

For a long-lived receptionist with unrestricted movements, the recommended
production asset is a matching, manually reviewed 3D model with an armature,
facial shape keys, and authored action clips. Blender's
[glTF exporter](https://docs.blender.org/manual/id/5.0/addons/import_export/scene_gltf2.html)
supports object/bone transforms and shape keys; Three.js provides an
[animation mixer](https://threejs.org/docs/pages/AnimationMixer) for playback.
The free toolchain is available, but creating and validating the matching model
is separate work. Generated videos alone do not solve interruptible speech,
consistent clip boundaries, or exact live lip sync.

The live receptionist uses `useVoiceSession.ts` and `voicePlaybackQueue.ts` in
`ui/src/features/guest/chat/hooks/`. Integration still needs a streaming
mouth-cue provider, synchronization to that playback clock, cue clearing on
interruption, semantic action selection, and mobile runtime profiling. This
preview exposes `playAction(name)` for action testing, but has no live AI model
connection and does not infer emotion or gestures from a guest conversation.

## Scope and quality gate

Documentation maintenance: this README and generation provenance describe the
local prototype. Route guides, support content, save guards, skeletons, audit
logging, plans and permissions are not applicable: no app route, user data,
editable form, or live capability changes. Mobile controls use 44 px targets;
the stage and gesture grid remain available on phones.

The earlier repository-wide quality gate passed frontend type-check, lint,
unit tests/coverage, and edge type-check, then stopped because Deno could not
resolve `npm:@types/node` in the isolated checkout. Later stages were not run.
This iteration uses the focused motion and browser/export checks above. The
branch remains a draft PR into `develop`; merging requires visual review.
