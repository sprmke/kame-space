import { KameMascot } from '@/components/mascot/KameMascot';
import { cn } from '@/lib/utils';

type KameButtonProps = {
  onClick?: () => void;
  /** Show "Ask Kame" label (Today root only). */
  labelled?: boolean;
  className?: string;
  disabled?: boolean;
};

/** 32px Kame avatar button. Hidden by the caller when AI is off for the scope. */
export function KameButton({ onClick, labelled = false, className, disabled }: KameButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Ask Kame"
      className={cn(
        'native-v3-press bg-appbar-control inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full',
        'focus-visible:ring-appbar-foreground/40 focus-visible:outline-none focus-visible:ring-2',
        'disabled:pointer-events-none disabled:opacity-50',
        labelled ? 'pl-1.5 pr-3' : 'w-11',
        className
      )}
    >
      <span className="bg-appbar-foreground/10 inline-flex size-8 items-center justify-center overflow-hidden rounded-full">
        <KameMascot pose="ai-assistant" role="ai" className="size-8" />
      </span>
      {labelled ? (
        <span className="text-appbar-foreground text-[13px] font-semibold leading-4">Ask Kame</span>
      ) : null}
    </button>
  );
}
