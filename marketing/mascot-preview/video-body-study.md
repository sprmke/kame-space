# Video-body experiment

Status: researched, not generated or visually validated. Study 04 is preserved
at commit 5dd34dde2 and in draft PR 353. Its manually articulated sprite joints
were rejected in visual review; retain it for comparison, not production use.

## Recommendation

Test one whole-character video with a blank face and independently composited
facial animation. Keep all limbs, shell, head volume and body lighting baked
into the video. Do not animate body cutouts. Start with a gentle wave and small
head movement; sitting, jumping and hands crossing the face come later.

A video library can serve a fixed-camera receptionist. It does not guarantee
arbitrary transitions, exact identity or freedom from generation artifacts.
A matching 3D model remains the strongest production option for arbitrary poses:
it supplies real head transforms, depth/occlusion and facial shape keys. It
requires modeling, rigging and visual approval; it is not an automatic conversion
of the approved PNG.

## One-clip test

Use assets/face-base.png as the existing blank-face reference. Generate a short
whole-body wave, with locked camera, unchanged proportions and lighting, blank
face, minimal head yaw, no face occlusion, and the same reference as first and
last frame. The reference already has its arm raised: request a small greeting
wave returning to that exact raised-arm pose, rather than inventing a new rest.

Prompt: Preserve this exact turtle and its rendering style. Locked camera and
lighting. A small friendly hand wave with subtle natural breathing and head
movement. Keep the green face completely blank: no eyes, mouth, eyebrows or
new markings; retain original cheeks and crown spots. No body stretching,
melting, extra limbs or camera movement. Hold the reference pose briefly before
and after the gesture. Return to the exact starting silhouette and stop moving
before the clip ends. Keep the face nearly front-facing and unobstructed.

First test on a solid background. Transparent video is a separate matting and
browser-compatibility task; do not assume generated MP4 contains alpha.

1. Review the unmodified clip for identity, limbs, anatomy and temporal artifacts.
2. Track several stable head features (crown spots, cheeks, silhouette) offline.
   The blank face makes generic human face-landmark detection inappropriate.
3. Fit a small face attachment surface, with manually corrected keyframes.
   Translation/rotation suffice only for near-frontal motion. Perspective turns
   require a surface/3D proxy, not simply shifting two images in x/y.
4. Export timestamped attachment transforms and visibility/occlusion masks.
5. Composite rendered eyes and mouth onto that surface. Drive lip shapes from
   speech timing independently of the video clip. Match lighting and scale.
6. Test repeated joins. Match pose, velocity, lighting, framing and shadow;
   identical endpoint images alone do not ensure smooth motion. Prefer brief
   settled handles. Do not hide mismatched silhouettes with crossfades.
7. Test interruptions: speech stops immediately; body moves to a prevalidated
   exit/neutral segment. Do not promise instant arbitrary clip-to-clip switching.

Only expand after the wave passes. A gesture asset should include enter, hold
(optional loop), and exit segments, with validated transition points. Seated
and standing poses are distinct states requiring explicit connecting clips.

## Acceptance checks

- Original mascot appearance remains stable throughout the clip.
- Eyes and mouth stay attached at large and 160 px sizes; no sliding or jitter.
- Mouth timing remains independent while video loops or changes segments.
- No doubled features at joins, no visible velocity jumps, no malformed limbs.
- Hand/head occlusion is correct before accepting any hand-over-face action.
- Test slow playback, repeated transitions, dark/light backgrounds and mobile.
- Existing sprite-export videos do not count as evidence for this approach.

## Tools and costs checked

The connected Weave Veo 3.1 image-to-video model exposes first image and optional
last frame, 4/6/8-second duration, and an approximate 90-credit run estimate.
No run was submitted. Prior no-payment preference remains in effect; available
account credits and current subscription eligibility have not been established.
Google's API pricing lists no free Veo tier.

LTX supports image/keyframe conditioning and is an open-model research candidate.
Open weights do not imply free hosted compute or verified compatibility with
this Mac. No local install, large model download or performance claim is made.

Sources checked:
- Google video first/last frame conditioning: https://ai.google.dev/gemini-api/docs/omni
- Google pricing: https://ai.google.dev/gemini-api/docs/pricing
- Blender tracking: https://docs.blender.org/manual/en/5.2/movie_clip/tracking/introduction.html
- Plane compositing (flat-plane limitation): https://docs.blender.org/manual/en/latest/compositing/types/tracking/plane_track_deform.html
- LTX repository: https://github.com/Lightricks/LTX-Video
- LTX keyframe bindings: https://github.com/Lightricks/LTX-2/blob/main/CHANGELOG.md

Next unresolved dependency: obtain an actual generated whole-body video through
an approved credit-funded run or a verified local/free generation route. No
hybrid animation result is claimed until that footage and face tracking are tested.
