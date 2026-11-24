import {
  KAME_MASCOT_WIDTH,
  kameMascotHeight,
  kameMascotSrc,
  type KameMascotPose,
} from '@/components/branding/kameMascotAssets';
import { cn } from '@/lib/utils';

type Props = {
  pose: KameMascotPose;
  className?: string;
  /** Full-page empties (404 / Services) may set this for LCP. */
  priority?: boolean;
  /** Below-the-fold poses (pose swaps that stack every frame) should defer. */
  lazy?: boolean;
};

/**
 * Transparent PNG from the public Kame character library.
 * Do not use receptionist `/avatars/*` stills here.
 */
export function KameMascotImage({ pose, className, priority = false, lazy = false }: Props) {
  return (
    <img
      src={kameMascotSrc(pose)}
      alt=""
      aria-hidden="true"
      width={KAME_MASCOT_WIDTH}
      height={kameMascotHeight(pose)}
      decoding="async"
      loading={lazy ? 'lazy' : undefined}
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('h-auto w-full max-w-full object-contain', className)}
    />
  );
}
