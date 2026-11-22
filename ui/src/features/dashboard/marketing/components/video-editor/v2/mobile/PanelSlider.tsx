import { useId } from 'react';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Shown after the value, for example `%` or `s`. */
  unit?: string;
};

/**
 * A slider for the phone panels: the label and the value on one line, a thumb you can hit with a
 * thumb. No number box: typing digits on a phone is the opposite of "easy".
 */
export function PanelSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
}: Props) {
  const id = useId();
  const share = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-muted-foreground text-xs">
          {label}
        </label>
        <span className="text-foreground text-xs font-medium tabular-nums" aria-hidden>
          {Number.isInteger(step) ? Math.round(value) : value.toFixed(1)}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${value}${unit}`}
        className="h-11 w-full cursor-pointer touch-pan-y appearance-none rounded-full bg-transparent focus-visible:outline-none [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
        style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--primary)) ${share}%, hsl(var(--muted)) ${share}%)`,
          backgroundSize: '100% 6px',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}
