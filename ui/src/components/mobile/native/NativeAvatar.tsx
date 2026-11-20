import { cn } from '@/lib/utils';

type NativeAvatarProps = {
  src?: string | null;
  name: string;
  size?: 32 | 36 | 40;
  className?: string;
  /** Parking badge ("P") when no photo. */
  badge?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

/** Lead avatar for list rows and the scope chip (32px default). */
export function NativeAvatar({ src, name, size = 32, className, badge }: NativeAvatarProps) {
  const dim = size === 32 ? 'size-8' : size === 36 ? 'size-9' : 'size-10';
  return (
    <span
      className={cn(
        'bg-tint text-tint-foreground relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold',
        dim,
        className
      )}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" decoding="async" loading="lazy" />
      ) : badge ? (
        <span className="text-native-pill">{badge}</span>
      ) : (
        initials(name)
      )}
    </span>
  );
}
