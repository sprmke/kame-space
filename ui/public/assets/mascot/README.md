# Kame mascot character library

This directory contains the approved 3D-style Kame mascot as reusable transparent PNGs.
The still-character library is intentionally independent from the experimental AI receptionist
animation work.

## Asset contract

- Format: losslessly optimized RGBA PNG
- Canvas: 448 × 468 pixels
- Background: transparent
- Shadow: retained inside the transparent canvas
- Character: approved green Kame turtle with the engraved Kame shell mark
- Public URL: `/assets/mascot/<file>.png`

Use descriptive alternative text based on the surrounding message. Treat the mascot as
decorative with `alt=""` when nearby visible copy already communicates the same state.

## Categories

- Conversation: `hello`, `listening`, `explaining`, `thinking`, `delighted`, `happy-hop`
- Hospitality: `arrival`, `directions`, `room-key`, `housekeeping`, `guest-review`, `travel-dates`
- Discovery: `discover`, `favorites`, `properties`, `developments`, `parking-listings`, `parking-guide`
- Product states: `coming-soon`, `page-not-found`, `something-went-wrong`, `scheduled-maintenance`, `offline`
- Product actions: `install-app`, `sign-in`, `success-toast`, `notice`, `announcement`, `analytics`, `voucher`
- Lifestyle: `seated`, `lounging`, `peekaboo`, `sweet-dreams`, `phone`, `photographer`, `teammate`
- Travel and leisure: `pool-float`, `pool-ready`, `beach-chair`, `rainy-day`
- Seasonal: `halloween`, `christmas-parol`, `valentine`, `new-year`, `easter`
- Reference: `shell`, `maintenance`

Open `gallery.html` from this directory to review every pose on light, dark, or mint backgrounds.
The complete machine-readable catalog is in `manifest.json`.

## Variants for the app

The 448 px masters are too heavy for lists and app bars. The app renders poses through
`KameMascot` (`ui/src/components/mascot/`), which serves pre-rendered WebP variants from `v/`
(`<pose>-96.webp`, `-160.webp`, `-320.webp`) through `srcset`. After adding or replacing a pose:

1. Update `manifest.json`.
2. Run `node scripts/media/generate-mascot-variants.mjs`.
3. Add the slug to `kameMascotPoses.ts` (a unit test fails if it drifts from the manifest).

Where a pose may appear, and at what size, is governed by `.cursor/rules/kame-mascot.mdc`.
