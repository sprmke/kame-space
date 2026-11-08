import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MicOff, PhoneOff } from 'lucide-react';

import { useShowcaseSteps, useTypewriter } from '@/features/guest/auth/hooks/useShowcaseTimeline';
import { SWAP } from '@/features/guest/auth/lib/guestShowcaseMotion';
import type { ReceptionistAvatarState } from '@/features/guest/chat/components/voice/receptionistAvatarTypes';
import { TURTLE_IDLE_POSTER_SRC } from '@/features/guest/chat/components/voice/receptionistAvatarVideo';
import { VoiceBoothRing } from '@/features/guest/chat/components/voice/VoiceBoothRing';

import { cn } from '@/lib/utils';

// The live receptionist is the real three.js turtle rig; load it only when the call opens.
const ReceptionistAvatar = lazy(() =>
  import('@/features/guest/chat/components/voice/ReceptionistAvatar').then((m) => ({
    default: m.ReceptionistAvatar,
  }))
);

let webglSupport: boolean | null = null;

/** One cheap probe per page: the rig needs WebGL, and some devices or browsers have none. */
function canUseWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    webglSupport = Boolean(
      gl &&
      'getShaderPrecisionFormat' in gl &&
      gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
    );
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/** Keeps a WebGL failure inside the stage: show the still turtle instead of breaking the page. */
class AvatarBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function TurtlePoster({ size }: { size: number }) {
  return (
    <img
      src={TURTLE_IDLE_POSTER_SRC}
      alt=""
      width={size}
      height={size}
      className="rounded-full bg-[#DDF7EB] object-cover"
    />
  );
}

const GUEST_LINE = 'Is the pool open at night?';
const RECEPTIONIST_LINE = 'Yes, until 10 PM. Towels are at the lobby desk.';
const STATES: ReceptionistAvatarState[] = [
  'connecting',
  'listening',
  'thinking',
  'speaking',
  'idle',
];
const STATUS_LABEL: Record<ReceptionistAvatarState, string> = {
  idle: 'Ask me anything',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Call ended',
};

function useAvatarSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize(Math.round(Math.max(64, Math.min(height - 6, width * 0.62, 150))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

/** Feeds the same CSS meters the live booth uses, so the turtle lip-syncs and the ring pulses. */
function useFakeVoiceMeters(state: ReceptionistAvatarState) {
  const reduce = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const el = hostRef.current;
    if (!el || reduce) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = (now - started) / 1000;
      const current = stateRef.current;
      const out =
        current === 'speaking'
          ? 0.25 + 0.6 * Math.abs(Math.sin(t * 8.5)) * (0.55 + 0.45 * Math.sin(t * 2.1))
          : 0;
      const input = current === 'listening' ? 0.2 + 0.4 * Math.abs(Math.sin(t * 6.3)) : 0;
      el.style.setProperty('--voice-out', out.toFixed(3));
      el.style.setProperty('--voice-in', input.toFixed(3));
      el.style.setProperty('--voice-amp', Math.max(out, input).toFixed(3));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [reduce]);

  return hostRef;
}

function Caption({ who, text, mine }: { who: string; text: string; mine?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex max-w-full flex-col gap-0.5', mine ? 'items-end' : 'items-start')}
    >
      <span className="text-muted-foreground text-[9px] font-semibold uppercase tracking-wider">
        {who}
      </span>
      <span
        className={cn(
          'rounded-2xl px-2.5 py-1.5 text-[11px] leading-snug',
          mine
            ? 'bg-primary-strong text-primary-foreground rounded-br-sm'
            : 'bg-card border-border/70 text-foreground rounded-bl-sm border shadow-sm'
        )}
      >
        {text || ' '}
      </span>
    </motion.div>
  );
}

/** Voice call with the AI receptionist, as it appears in the guest chat. */
export function GuestShowcaseVoiceCall() {
  // connecting, listening, thinking, speaking, done (ms after the call opens)
  const step = useShowcaseSteps([700, 2300, 2900, 5700]);
  const state = STATES[step] ?? 'idle';
  const guest = useTypewriter(GUEST_LINE, 900, 45);
  const reply = useTypewriter(RECEPTIONIST_LINE, 3000, 50);
  const meterRef = useFakeVoiceMeters(state);
  const { ref: avatarBoxRef, size } = useAvatarSize();
  const busy = state === 'connecting' || state === 'thinking';

  return (
    <motion.div
      ref={meterRef}
      className="bg-background from-primary/[0.14] absolute inset-0 z-30 flex flex-col gap-2 bg-gradient-to-b to-transparent p-3 @[420px]:p-4"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
    >
      <div className="flex items-center gap-2">
        <span className="text-foreground text-[11px] font-bold">Receptionist</span>
        <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-bold">
          AI
        </span>
        <span className="text-muted-foreground ml-auto flex items-center gap-1 text-[10px]">
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full',
              busy ? 'bg-warning animate-pulse' : 'bg-primary'
            )}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={state} {...SWAP}>
              {STATUS_LABEL[state]}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>

      <div className="@[420px]:flex-row @[420px]:gap-4 flex min-h-0 flex-1 flex-col items-center gap-2">
        <div
          ref={avatarBoxRef}
          className="@[420px]:h-full @[420px]:w-auto @[420px]:flex-[0_0_42%] flex min-h-0 w-full flex-1 items-center justify-center"
        >
          {size > 0 ? (
            <div className="relative" style={{ width: size, height: size }}>
              <VoiceBoothRing state={state} busy={busy} className="scale-[1.1]" />
              {canUseWebGL() ? (
                <AvatarBoundary fallback={<TurtlePoster size={size} />}>
                  <Suspense fallback={<TurtlePoster size={size} />}>
                    <ReceptionistAvatar state={state} size={size} />
                  </Suspense>
                </AvatarBoundary>
              ) : (
                <TurtlePoster size={size} />
              )}
            </div>
          ) : null}
        </div>

        <div className="@[420px]:flex-1 flex w-full min-w-0 flex-col justify-center gap-2">
          {step >= 1 ? <Caption who="You" text={guest.typed} mine /> : null}
          {step >= 3 ? <Caption who="Receptionist" text={reply.typed} /> : null}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <span className="border-border bg-card text-muted-foreground flex size-7 items-center justify-center rounded-full border">
          <MicOff className="size-3.5" aria-hidden />
        </span>
        <span className="bg-destructive text-destructive-foreground flex size-7 items-center justify-center rounded-full">
          <PhoneOff className="size-3.5" aria-hidden />
        </span>
      </div>
    </motion.div>
  );
}
