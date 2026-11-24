import { KameMascotImage } from '@/components/branding/KameMascotImage';

/** Labelled range slider used by the v5 fee calculators. Shows the value as the host reads it. */
export function V5RangeField({
  id,
  label,
  display,
  suffix,
  valueText,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  /** The value as the host reads it, e.g. a peso amount. */
  display: string;
  /** Unit shown after the value, e.g. `/ night`. Visual only; put it in `valueText` too. */
  suffix?: string;
  /** What a screen reader hears; defaults to `display`. */
  valueText?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const progress = (value - min) / (max - min);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-foreground text-sm font-medium">
          {label}
        </label>
        <span aria-hidden className="text-foreground text-xl font-bold tabular-nums">
          {display}
          {suffix ? (
            <span className="text-muted-foreground ml-1 text-sm font-medium">{suffix}</span>
          ) : null}
        </span>
      </div>
      <div className="relative flex h-11 items-center">
        <span aria-hidden className="bg-muted absolute inset-x-0 h-2 rounded-full" />
        <span
          aria-hidden
          className="bg-primary-strong absolute left-0 h-2 rounded-full"
          style={{ width: `calc(${progress} * (100% - 2.75rem) + 1.375rem)` }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={valueText ?? display}
          onChange={(event) => onChange(Number(event.target.value))}
          className="peer relative h-11 w-full cursor-pointer touch-pan-y appearance-none bg-transparent focus-visible:outline-none [&::-moz-range-thumb]:size-11 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:size-11 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-transparent"
        />
        {/* Kame in its shell is the visible thumb; the transparent native thumb above handles input.
            The art is mirrored so Kame faces right, the way the slider fills. */}
        <span
          aria-hidden
          className="peer-focus-visible:ring-primary/30 pointer-events-none absolute top-0 size-11 rounded-full transition-transform duration-150 peer-focus-visible:ring-4 peer-active:scale-110"
          style={{
            left: `calc(${progress} * (100% - 2.75rem))`,
            rotate: `${(progress - 0.5) * 24}deg`,
          }}
        >
          <KameMascotImage
            pose="peekaboo"
            lazy
            className="absolute -top-[0.9rem] left-[-0.88rem] w-16 max-w-none -scale-x-100 drop-shadow-md"
          />
        </span>
      </div>
    </div>
  );
}
