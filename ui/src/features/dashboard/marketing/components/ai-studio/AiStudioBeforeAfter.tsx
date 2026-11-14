import { useState } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  before: string;
  after: string;
  alt: string;
};

/**
 * The edited photo with the original under a draggable divider. A range input drives it,
 * so the keyboard and screen readers get the same control as a finger.
 */
export function AiStudioBeforeAfter({ before, after, alt }: Props) {
  const [position, setPosition] = useState(50);

  return (
    <div className="relative size-full select-none">
      <img src={after} alt={alt} className="absolute inset-0 size-full object-contain" />
      <img
        src={before}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-contain"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
        style={{ left: `${position}%` }}
        aria-hidden
      />
      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
        Before
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
        After
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label="Compare before and after"
        className={cn(
          'absolute inset-0 size-full cursor-ew-resize opacity-0',
          'focus-visible:opacity-100 focus-visible:[&::-webkit-slider-runnable-track]:bg-transparent'
        )}
      />
    </div>
  );
}
