import {
  KAME_MASCOT_HEIGHT,
  KAME_MASCOT_WIDTH,
  kameMascotSrc,
  type KameMascotPose,
} from '@/components/branding/kameMascotAssets';
import { cn } from '@/lib/utils';

type Props = {
  pose: KameMascotPose;
  className?: string;
  /** Full-page empties (404 / Services) may set this for LCP. */
  priority?: boolean;
};

/**
 * Transparent PNG from the public Kame character library.
 * Do not use receptionist `/avatars/*` stills here.
 */
export function KameMascotImage({ pose, className, priority = false }: Props) {
  return (
    <img
      src={kameMascotSrc(pose)}
      alt=""
      aria-hidden="true"
      width={KAME_MASCOT_WIDTH}
      height={KAME_MASCOT_HEIGHT}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('h-auto w-full max-w-full object-contain', className)}
    />
  );
}
