# Kame mascot character library

This directory contains the approved 3D-style Kame mascot as reusable transparent PNGs.
The still-character library is intentionally independent from the experimental AI receptionist
animation work.

## Asset contract

- Format: losslessly optimized RGBA PNG
- Canvas: 448 × 468 pixels for the original library; newer edge and AI poses are 448 × 448 pixels
- Background: transparent
- Shadow: retained inside the transparent canvas
- Character: approved green Kame turtle with the engraved Kame shell mark
- Public URL: `/assets/mascot/<file>.png`, including the category subfolders below

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
- AI: `ai/full/` for standalone assistant states and `ai/peek/` for card-edge assistant states
- Landing edge: `landing/edge/standard/`, `landing/edge/costumes/`, and `landing/edge/playful/`
- Announcements: `announcements/platform/` and `announcements/building/`
- Billing: `billing/`
- Verification and recommendations: `verification/`

The AI and edge poses are still images only. They remain separate from the experimental AI
receptionist animation work.

Open `gallery.html` from this directory to review every pose on light, dark, or mint backgrounds.
The complete machine-readable catalog is in `manifest.json`.
