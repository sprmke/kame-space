import { motion } from 'framer-motion';

import type { KameMascotPose } from '@/components/branding/kameMascotAssets';
import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export interface V5CornerPeek {
  /** The card's corner radius, e.g. `1.75rem`. */
  radius: string;
  /**
   * Fraction of the art's width where a peek pose's flat body cut sits (its hand grips past
   * it). Poses not listed are drawn whole and kept inside the corner.
   */
  edges: Partial<Record<KameMascotPose, number>>;
}

/**
 * Masks a pose to a card's bottom-right corner: everything left of the card edge, everything
 * above the corner, and the rounded corner itself. Only the hand and head reach past the edge.
 */
function cornerMask(edge: number, radius: string) {
  const x = `${edge * 100}%`;
  const mask = [
    `linear-gradient(to bottom, #000 calc(100% - ${radius}), transparent 0)`,
    `linear-gradient(to right, #000 calc(${x} - ${radius}), transparent 0)`,
    `radial-gradient(circle ${radius} at calc(${x} - ${radius}) calc(100% - ${radius}), #000 calc(100% - 0.5px), transparent 100%)`,
  ].join(', ');
  return { maskImage: mask, WebkitMaskImage: mask };
}

/**
 * Kame in several poses stacked in one box; only `active` shows, popping in from the feet.
 * Every pose stays mounted so a swap never waits on an image request.
 *
 * With `cornerPeek`, place the box flush in a card's bottom-right corner, outside the card's
 * clipping: each peek pose shifts right so its body cut lands on the card edge.
 */
export function V5PoseStack({
  poses,
  active,
  cornerPeek,
  className,
}: {
  poses: readonly KameMascotPose[];
  active: KameMascotPose;
  cornerPeek?: V5CornerPeek;
  className?: string;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const unique = [...new Set(poses)];

  return (
    <div aria-hidden className={cn('relative aspect-[448/468]', className)}>
      {unique.map((pose) => {
        const on = pose === active;
        const edge = cornerPeek ? (cornerPeek.edges[pose] ?? 1) : 1;
        const shift = `${(1 - edge) * 100}%`;
        return (
          <motion.div
            key={pose}
            initial={false}
            animate={on ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 10 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : on
                  ? { type: 'spring', stiffness: 320, damping: 17 }
                  : { duration: 0.14 }
            }
            className="absolute inset-0 grid origin-bottom items-end"
            style={
              cornerPeek
                ? { left: shift, right: `-${shift}`, ...cornerMask(edge, cornerPeek.radius) }
                : undefined
            }
          >
            <KameMascotImage pose={pose} lazy />
          </motion.div>
        );
      })}
    </div>
  );
}
