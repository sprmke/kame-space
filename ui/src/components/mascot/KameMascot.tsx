import { KAME_MASCOT_ASPECT, type KameMascotPose } from '@/components/mascot/kameMascotPoses';
import {
  type KameMascotRole,
  isPoseAllowedForRole,
  mascotFallbackWidth,
  mascotRoleSize,
  mascotSrcSet,
  mascotVariantUrl,
} from '@/components/mascot/kameMascotRoles';
import { cn } from '@/lib/utils';

type KameMascotProps = {
  pose: KameMascotPose;
  /** The job this mascot has. Fixes the size and restricts the poses (see `kame-mascot.mdc`). */
  role: KameMascotRole;
  /**
   * Decorative by default (`alt=""`), because nearby text already says the same thing. Pass `alt`
   * only when the mascot carries meaning nothing else on screen does.
   */
  alt?: string;
  /** Milestone screens render eagerly; everything else is lazy. */
  priority?: boolean;
  className?: string;
};

/**
 * The only way to render the Kame mascot. One pose, one role, a pre-rendered WebP ladder.
 * Never place it in an app bar, tab bar, list row, form, metric tile, calendar or a serious
 * (money, legal, security) state: see `.cursor/rules/kame-mascot.mdc`.
 */
export function KameMascot({ pose, role, alt = '', priority = false, className }: KameMascotProps) {
  if (import.meta.env.DEV && !isPoseAllowedForRole(role, pose)) {
    console.warn(`KameMascot: pose "${pose}" is not allowed for role "${role}".`);
  }

  const size = mascotRoleSize(role);
  const height = Math.round(size * KAME_MASCOT_ASPECT);

  return (
    <img
      src={mascotVariantUrl(pose, mascotFallbackWidth(size))}
      srcSet={mascotSrcSet(pose)}
      sizes={`${size}px`}
      width={size}
      height={height}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={cn('pointer-events-none shrink-0 select-none object-contain', className)}
    />
  );
}
