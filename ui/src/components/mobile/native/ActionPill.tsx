import { cn } from '@/lib/utils';

type ActionPillProps = {
  children: React.ReactNode;
  onClick?: () => void;
  /** Outline glass on the brand band (default) or filled white. */
  variant?: 'outline' | 'solid';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
};

/** Named primary action on the app bar ("Add booking"). */
export function ActionPill({
  children,
  onClick,
  variant = 'outline',
  className,
  disabled,
  type = 'button',
}: ActionPillProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'native-v3-press text-native-button inline-flex h-9 min-w-[44px] shrink-0 items-center justify-center rounded-full px-3.5',
        'focus-visible:ring-appbar-foreground/40 focus-visible:outline-none focus-visible:ring-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'outline'
          ? 'bg-appbar-control text-appbar-foreground border border-white/20'
          : 'text-appbar bg-white',
        className
      )}
    >
      {children}
    </button>
  );
}
