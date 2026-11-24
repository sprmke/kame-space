/**
 * Approved 3D-style Kame poses from `ui/public/assets/mascot/` (see README + manifest.json).
 * Independent from the voice receptionist avatar stills under `/avatars/`.
 */

/** Canvas size of the original library PNGs in the mascot root (manifest.json). */
export const KAME_MASCOT_WIDTH = 448;
export const KAME_MASCOT_HEIGHT = 468;
/** Poses in category subfolders (`ai/`, `landing/`, ...) use a square 448 x 448 canvas. */
export const KAME_MASCOT_SQUARE_HEIGHT = 448;

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
  /** For-hosts v5 hero: one pose per job (keys, coins, clapperboard). */
  'booking-confirmed': 'booking-confirmed.png',
  'finance-ledger': 'finance-ledger.png',
  'marketing-studio': 'marketing-studio.png',
  /** For-hosts v5 setup steps (filing tray, settings dial, megaphone, beach chair). */
  importing: 'importing.png',
  'workspace-settings': 'workspace-settings.png',
  announcement: 'announcement.png',
  'beach-chair': 'beach-chair.png',
  /** For-hosts v5: `peekaboo` peeks over the fee slider; `hello` is not used right now. */
  peekaboo: 'peekaboo.png',
  hello: 'hello.png',
  /**
   * For-hosts v5: `thinking` (fee calculator) and `ai-assistant` (hero) are in use;
   * `explaining` and `plans-billing` are not used right now and stay for reuse.
   */
  thinking: 'thinking.png',
  explaining: 'explaining.png',
  'plans-billing': 'plans-billing.png',
  'ai-assistant': 'ai-assistant.png',
  /** For-hosts v5 AI mode: holds up a check when the host confirms. */
  'success-toast': 'success-toast.png',
  /** For-hosts v5 fee calculator: Kame holds the plant of the picked plan. */
  'plan-starter': 'plan-starter.png',
  'plan-pro': 'plan-pro.png',
  'plan-business': 'plan-business.png',
  listening: 'listening.png',
  'pricing-calendar': 'pricing-calendar.png',
  'analytics-insight': 'analytics-insight.png',
  photographer: 'photographer.png',
  /**
   * AI peek (PR #587): headset, hand on ear. Flat cut on the right and bottom, so it sits behind
   * a card edge. For-hosts v5 guest help chat.
   */
  'ai-peek-right-listen': 'ai/peek/ai-peek-right-listen.png',
  /** For-hosts v5 AI job cards: matching peek poses with job-specific props. */
  'v5-ai-assistant': 'landing/v5-ai/assistant.png',
  'v5-ai-receptionist': 'landing/v5-ai/receptionist.png',
  'v5-ai-receipts': 'landing/v5-ai/receipts.png',
  'v5-ai-import': 'landing/v5-ai/import.png',
  'v5-ai-pricing': 'landing/v5-ai/pricing.png',
  'v5-ai-analytics': 'landing/v5-ai/analytics.png',
  'v5-ai-replies': 'landing/v5-ai/replies.png',
  'v5-ai-marketing': 'landing/v5-ai/marketing.png',
  'v5-ai-done-stamp': 'landing/v5-ai/done-stamp.png',
  'v5-ai-done-celebrate': 'landing/v5-ai/done-celebrate.png',
  /** For-hosts v5 channel hub avatar: bust holding a sync badge, drawn for a round frame. */
  'v5-sync': 'landing/v5-sync.png',
} as const;

export type KameMascotPose = keyof typeof KAME_MASCOT_POSES;

/** Canvas height of a pose: subfolder poses are square, the original library is 468 tall. */
export function kameMascotHeight(pose: KameMascotPose): number {
  return KAME_MASCOT_POSES[pose].includes('/') ? KAME_MASCOT_SQUARE_HEIGHT : KAME_MASCOT_HEIGHT;
}

export function kameMascotSrc(pose: KameMascotPose): string {
  return `/assets/mascot/${KAME_MASCOT_POSES[pose]}`;
}
