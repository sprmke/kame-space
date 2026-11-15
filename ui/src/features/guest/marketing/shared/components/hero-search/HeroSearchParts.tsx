import { forwardRef } from 'react';

import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';

import type { SearchField } from '@/features/guest/marketing/shared/lib/heroSearchState';
import { lerp, smoothstep } from '@/features/guest/marketing/shared/lib/listingScrollSearchEasing';
import {
  flexOptionLabel,
  SEARCH_FLEX_DAYS,
  type SearchFlexDays,
} from '@/features/guest/marketing/shared/lib/searchFlexDays';

import { cn } from '@/lib/utils';

const PILL_SPRING = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.82 };

export type SegmentPillBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function ActiveSegmentPill({
  bounds,
  roundedClass,
}: {
  bounds: SegmentPillBounds;
  roundedClass: string;
}) {
  return (
    <motion.div
      aria-hidden
      className={cn('bg-background pointer-events-none absolute z-0 shadow-md', roundedClass)}
      initial={false}
      animate={{
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }}
      transition={PILL_SPRING}
    />
  );
}

interface GuestRowProps {
  label: string;
  subtitle?: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number;
  /** `lg` = phone full-screen search: 16px labels, 36px circles with a 44px hit area. */
  size?: 'default' | 'lg';
}

export function GuestRow({
  label,
  subtitle,
  value,
  onDecrement,
  onIncrement,
  min = 0,
  max = 16,
  size = 'default',
}: GuestRowProps) {
  const large = size === 'lg';
  const stepperClass = cn(
    'border-border relative flex shrink-0 items-center justify-center rounded-full border',
    'text-foreground hover:border-foreground/60 transition-[border-color,opacity,transform]',
    'active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 disabled:active:scale-100',
    large
      ? "size-9 before:absolute before:-inset-1 before:content-['']"
      : 'text-muted-foreground min-h-[44px] min-w-[44px]'
  );

  return (
    <div className={cn('flex items-center justify-between gap-4', large ? 'py-5' : 'py-4')}>
      <div className="min-w-0">
        <p className={cn('text-foreground font-semibold', large ? 'text-base' : 'text-sm')}>
          {label}
        </p>
        {subtitle ? (
          <p className={cn('text-muted-foreground', large ? 'text-sm' : 'text-xs')}>{subtitle}</p>
        ) : null}
      </div>
      <div className={cn('flex items-center', large ? 'gap-4' : 'gap-3')}>
        <button
          type="button"
          onClick={onDecrement}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className={stepperClass}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span
          className={cn(
            'text-foreground text-center font-medium tabular-nums',
            large ? 'w-6 text-base' : 'w-5 text-sm'
          )}
          aria-live="polite"
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className={stepperClass}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

interface SearchSegmentProps {
  field: SearchField;
  label: string;
  value: string;
  placeholder: string;
  activeField: SearchField | null;
  onActivate: (field: SearchField) => void;
  className?: string;
  morphProgress?: number;
  compactPlaceholder?: string;
  /** Single-line header / mobile — no Where/When/Who labels. */
  compactLine?: boolean;
}

export const SearchSegment = forwardRef<HTMLButtonElement, SearchSegmentProps>(
  function SearchSegment(
    {
      field,
      label,
      value,
      placeholder,
      activeField,
      onActivate,
      className,
      morphProgress = 0,
      compactPlaceholder,
      compactLine = false,
    },
    ref
  ) {
    const isActive = activeField === field;
    const p = morphProgress;
    const labelOpacity = compactLine ? 0 : 1 - smoothstep(0.05, 0.35, p);
    const isFilled = Boolean(value);
    const display = value || (compactLine ? (compactPlaceholder ?? placeholder) : placeholder);

    if (compactLine) {
      return (
        <button
          ref={ref}
          type="button"
          aria-label={`${label}: ${display}`}
          onClick={() => onActivate(field)}
          className={cn(
            'relative z-[1] flex min-w-0 flex-1 basis-0 items-center justify-center truncate rounded-full px-2 py-2 text-center text-xs',
            className
          )}
        >
          <span
            className={cn(
              'relative truncate',
              isFilled ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium',
              isActive && 'text-foreground font-semibold'
            )}
          >
            {display}
          </span>
        </button>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onActivate(field)}
        className={cn(
          'relative z-[1] flex min-h-[52px] min-w-0 flex-1 flex-col justify-center rounded-full px-5 py-3 text-left',
          className
        )}
        style={{
          paddingLeft: `${lerp(25, 14, p)}px`,
          paddingRight: `${lerp(15, 14, p)}px`,
          paddingTop: `${lerp(5, 10, p)}px`,
          paddingBottom: `${lerp(5, 10, p)}px`,
        }}
      >
        {labelOpacity > 0.02 ? (
          <span
            className="text-foreground relative text-xs font-semibold"
            style={{
              opacity: labelOpacity,
              maxHeight: `${labelOpacity * 18}px`,
              overflow: 'hidden',
            }}
          >
            {label}
          </span>
        ) : null}
        <span
          className={cn(
            'relative truncate text-sm',
            labelOpacity > 0.5 && 'mt-0.5',
            isFilled ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium',
            isActive && 'text-foreground font-semibold'
          )}
        >
          {display}
        </span>
      </button>
    );
  }
);

const FLEX_OPTIONS: SearchFlexDays[] = [0, ...SEARCH_FLEX_DAYS];

/**
 * "Exact dates / ± 1 day / ± 2 days…" chips under the calendar (Airbnb flexible dates).
 * One row that scrolls sideways on narrow screens. Only meaningful with a full range,
 * so callers render it once check-out is picked.
 */
export function FlexDateChips({
  value,
  onChange,
  className,
}: {
  value: SearchFlexDays;
  onChange: (next: SearchFlexDays) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Date flexibility"
      className={cn('scrollbar-hide flex gap-2 overflow-x-auto', className)}
      onKeyDown={(event) => {
        // Radio group keys: one tab stop, arrows move and select.
        const step =
          event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? -1
              : 0;
        if (step === 0) return;
        event.preventDefault();
        const index = FLEX_OPTIONS.indexOf(value);
        const next = FLEX_OPTIONS[(index + step + FLEX_OPTIONS.length) % FLEX_OPTIONS.length]!;
        onChange(next);
        event.currentTarget.querySelector<HTMLButtonElement>(`[data-flex="${next}"]`)?.focus();
      }}
    >
      {FLEX_OPTIONS.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            data-flex={option}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option)}
            className={cn(
              "relative h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-[13px] font-medium transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']",
              selected
                ? 'border-foreground bg-foreground/[0.04] text-foreground ring-foreground ring-1'
                : 'border-border text-foreground hover:border-foreground/50'
            )}
          >
            {flexOptionLabel(option)}
          </button>
        );
      })}
    </div>
  );
}
