import { useEffect, useState } from 'react';

import { useReducedMotion } from 'framer-motion';

/**
 * Scene clock for the guest auth showcase. Returns how many of the given timestamps (ms since
 * mount) have passed. Scenes remount per chapter, so every visit replays from zero.
 * Reduced motion jumps straight to the final step.
 */
export function useShowcaseSteps(times: readonly number[]): number {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? times.length : 0);
  const key = times.join(',');

  useEffect(() => {
    if (reduce) {
      setStep(times.length);
      return;
    }
    setStep(0);
    const ids = times.map((time, index) =>
      window.setTimeout(() => setStep((current) => Math.max(current, index + 1)), time)
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
    // `key` captures `times` by value so inline arrays do not restart the clock each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduce]);

  return step;
}

/** Eased count from 0 to `target`, starting `delayMs` after mount. */
export function useCountUp(target: number, delayMs: number, durationMs = 700): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    setValue(0);
    let frame = 0;
    let startedAt = 0;
    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    const timer = window.setTimeout(() => {
      frame = window.requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [target, delayMs, durationMs, reduce]);

  return value;
}

/** Types `text` one character at a time after `startMs`. */
export function useTypewriter(text: string, startMs: number, stepMs = 50) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(reduce ? text.length : 0);

  useEffect(() => {
    if (reduce) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setCount((current) => {
          if (current >= text.length) {
            window.clearInterval(interval);
            return current;
          }
          return current + 1;
        });
      }, stepMs);
    }, startMs);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [text, startMs, stepMs, reduce]);

  return { typed: text.slice(0, count), done: count >= text.length };
}
