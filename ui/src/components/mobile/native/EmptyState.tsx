import { KameMascot } from '@/components/mascot/KameMascot';
import type { KameMascotPose } from '@/components/mascot/kameMascotPoses';
import { IconTile } from '@/components/mobile/native/IconTile';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Prefer mascot for first-use empty; icon for filtered-empty (no mascot). */
  icon?: LucideIcon;
  mascotPose?: KameMascotPose;
  className?: string;
};

export function EmptyState({
  title,
  actionLabel,
  onAction,
  icon,
  mascotPose,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      {mascotPose ? (
        <KameMascot pose={mascotPose} role="empty" />
      ) : icon ? (
        <IconTile icon={icon} />
      ) : null}
      <p className="text-native-body text-foreground max-w-xs">{title}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="native-v3-press bg-primary-strong text-primary-foreground text-native-button rounded-native-control mt-1 inline-flex h-11 items-center justify-center px-4"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
