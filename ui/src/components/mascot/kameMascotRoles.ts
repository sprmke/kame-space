import { KAME_MASCOT_WIDTHS, type KameMascotPose } from '@/components/mascot/kameMascotPoses';

/**
 * Kame mascot budget (`.cursor/rules/kame-mascot.mdc`). Five roles plus setup, each with a fixed
 * display size and a closed list of poses. The component refuses a pose outside its role in dev,
 * which is how the "mascot has a job" rule is enforced in code, not only in review.
 */
export type KameMascotRole = 'welcome' | 'daily' | 'ai' | 'empty' | 'milestone' | 'setup';

type RoleSpec = {
  /** CSS pixel size of the mascot box (width). Height follows the master aspect ratio. */
  size: number;
  /** Poses allowed outright. */
  poses: readonly KameMascotPose[];
  /** Pose-name prefixes allowed (for families such as `template-*`). */
  prefixes?: readonly string[];
};

/** Welcome-only seasonal poses; the caller is responsible for the date-bounded flag. */
export const KAME_SEASONAL_POSES = [
  'halloween',
  'christmas-parol',
  'valentine',
  'new-year',
  'easter',
] as const satisfies readonly KameMascotPose[];

export const KAME_MASCOT_ROLES: Record<KameMascotRole, RoleSpec> = {
  welcome: {
    size: 112,
    poses: ['hello', 'happy-hop', 'install-app', 'sign-in', ...KAME_SEASONAL_POSES],
  },
  daily: {
    size: 56,
    poses: ['dashboard-overview', 'explaining', 'arrival', 'parking-guide'],
  },
  ai: {
    size: 28,
    poses: ['ai-assistant', 'listening', 'thinking', 'explaining'],
  },
  empty: {
    size: 84,
    poses: [
      'page-not-found',
      'something-went-wrong',
      'gentle-failure',
      'offline',
      'coming-soon',
      'rainy-day',
      'finance-ledger',
      'maintenance',
      'guest-inbox',
      'properties',
      'parking-listings',
      'developments',
      'public-pages',
      'page-templates',
      'favorites',
      'voucher',
      'travel-dates',
      'analytics',
      'announcement',
      'teammate',
      'marketing-studio',
      'pricing-calendar',
      'help-support',
      'discover',
    ],
    prefixes: ['template-'],
  },
  milestone: {
    size: 112,
    poses: ['booking-confirmed', 'action-success', 'delighted', 'room-key', 'guest-review'],
  },
  setup: {
    size: 56,
    poses: ['workspace-settings', 'properties', 'parking-listings'],
  },
};

export function mascotRoleSize(role: KameMascotRole): number {
  return KAME_MASCOT_ROLES[role].size;
}

export function isPoseAllowedForRole(role: KameMascotRole, pose: KameMascotPose): boolean {
  const spec = KAME_MASCOT_ROLES[role];
  if (spec.poses.includes(pose)) return true;
  return Boolean(spec.prefixes?.some((prefix) => pose.startsWith(prefix)));
}

/** Variant URL for a pose at a given pre-rendered width. */
export function mascotVariantUrl(pose: KameMascotPose, width: (typeof KAME_MASCOT_WIDTHS)[number]) {
  return `/assets/mascot/v/${pose}-${width}.webp`;
}

/** `srcset` over the pre-rendered widths (`w` descriptors, so the browser picks for DPR). */
export function mascotSrcSet(pose: KameMascotPose): string {
  return KAME_MASCOT_WIDTHS.map((width) => `${mascotVariantUrl(pose, width)} ${width}w`).join(', ');
}

/** The smallest variant that still covers `cssSize` at 2x, used as the plain `src` fallback. */
export function mascotFallbackWidth(cssSize: number): (typeof KAME_MASCOT_WIDTHS)[number] {
  const needed = cssSize * 2;
  return (
    KAME_MASCOT_WIDTHS.find((width) => width >= needed) ??
    KAME_MASCOT_WIDTHS[KAME_MASCOT_WIDTHS.length - 1]
  );
}
