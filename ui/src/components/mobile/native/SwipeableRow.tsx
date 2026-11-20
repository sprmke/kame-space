import { useRef, useState, type ReactNode, type TouchEvent } from 'react';

import { cn } from '@/lib/utils';

export type SwipeAction = {
  key: string;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'destructive';
};

type SwipeableRowProps = {
  children: ReactNode;
  /** Leading (swipe right) primary action. */
  leading?: SwipeAction;
  /** Trailing (swipe left) secondary action. */
  trailing?: SwipeAction;
  className?: string;
};

const OPEN_PX = 88;
const THRESHOLD = 40;

/**
 * One-open-at-a-time swipe row. Visible ··· / buttons remain the primary path;
 * swipe is a shortcut that mirrors those actions.
 */
export function SwipeableRow({ children, leading, trailing, className }: SwipeableRowProps) {
  const startX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [openSide, setOpenSide] = useState<'leading' | 'trailing' | null>(null);

  const clamp = (dx: number) => {
    const maxLead = leading ? OPEN_PX : 0;
    const maxTrail = trailing ? OPEN_PX : 0;
    return Math.max(-maxTrail, Math.min(maxLead, dx));
  };

  const onTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? 0;
  };

  const onTouchMove = (e: TouchEvent) => {
    const x = e.touches[0]?.clientX ?? 0;
    const base = openSide === 'leading' ? OPEN_PX : openSide === 'trailing' ? -OPEN_PX : 0;
    setOffset(clamp(base + (x - startX.current)));
  };

  const onTouchEnd = () => {
    if (offset > THRESHOLD && leading) {
      setOpenSide('leading');
      setOffset(OPEN_PX);
      return;
    }
    if (offset < -THRESHOLD && trailing) {
      setOpenSide('trailing');
      setOffset(-OPEN_PX);
      return;
    }
    setOpenSide(null);
    setOffset(0);
  };

  const run = (action: SwipeAction) => {
    setOpenSide(null);
    setOffset(0);
    action.onClick();
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {leading ? (
        <div className="absolute inset-y-0 left-0 flex w-[88px] items-stretch">
          <button
            type="button"
            onClick={() => run(leading)}
            className={cn(
              'flex flex-1 items-center justify-center px-2 text-[12px] font-semibold',
              leading.tone === 'destructive'
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-primary-strong text-primary-foreground'
            )}
          >
            {leading.label}
          </button>
        </div>
      ) : null}
      {trailing ? (
        <div className="absolute inset-y-0 right-0 flex w-[88px] items-stretch">
          <button
            type="button"
            onClick={() => run(trailing)}
            className={cn(
              'flex flex-1 items-center justify-center px-2 text-[12px] font-semibold',
              trailing.tone === 'destructive'
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-muted text-foreground'
            )}
          >
            {trailing.label}
          </button>
        </div>
      ) : null}
      <div
        className="bg-card relative touch-pan-y transition-transform duration-150 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
