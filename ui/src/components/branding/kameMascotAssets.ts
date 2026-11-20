/**
 * Approved 3D-style Kame poses from `ui/public/assets/mascot/` (see README + manifest.json).
 * Independent from the voice receptionist avatar stills under `/avatars/`.
 */

/** Canvas size of every library PNG (manifest.json). */
export const KAME_MASCOT_WIDTH = 448;
export const KAME_MASCOT_HEIGHT = 468;

/**
 * Product-facing poses used in the SPA. Add here when wiring a new empty / state surface.
 * Filename stems match `/assets/mascot/<stem>.png`.
 */
export const KAME_MASCOT_POSES = {
  'page-not-found': 'page-not-found.png',
  'coming-soon': 'coming-soon.png',
  'something-went-wrong': 'something-went-wrong.png',
  'scheduled-maintenance': 'scheduled-maintenance.png',
  offline: 'offline.png',
  notice: 'notice.png',
  'gentle-failure': 'gentle-failure.png',
  'help-support': 'help-support.png',
  'travel-dates': 'travel-dates.png',
  /** Guest trips empty (suitcase / on the way). */
  arrival: 'arrival.png',
  favorites: 'favorites.png',
  voucher: 'voucher.png',
  'guest-inbox': 'guest-inbox.png',
  'guest-review': 'guest-review.png',
  /** Binoculars pose; search no-matches uses page-not-found instead. */
  discover: 'discover.png',
  /** Guest tickets empty (phone / reach support). */
  phone: 'phone.png',
  /** Host CTA / list-your-place (turtle holding a house). */
  properties: 'properties.png',
  /** Host CTA alternate (turtle with public listing page frame). */
  'public-pages': 'public-pages.png',
} as const;

export type KameMascotPose = keyof typeof KAME_MASCOT_POSES;

export function kameMascotSrc(pose: KameMascotPose): string {
  return `/assets/mascot/${KAME_MASCOT_POSES[pose]}`;
}
