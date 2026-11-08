import { useEffect, useRef, useState } from 'react';

import { Kame, REST, type Pose } from '../../../../../../../marketing/social/src/mascot/Kame';
import type { ReceptionistAvatarState } from '@/features/guest/chat/components/voice/receptionistAvatarTypes';
import { cn } from '@/lib/utils';

export type { ReceptionistAvatarState };

type Props = {
  state: ReceptionistAvatarState;
  size?: number;
  className?: string;
};

type NumericPoseField =
  | 'armL'
  | 'armR'
  | 'hop'
  | 'yaw'
  | 'headYaw'
  | 'headPitch'
  | 'tilt'
  | 'lids'
  | 'open'
  | 'wide'
  | 'blush';
const FIELDS: NumericPoseField[] = [
  'armL',
  'armR',
  'hop',
  'yaw',
  'headYaw',
  'headPitch',
  'tilt',
  'lids',
  'open',
  'wide',
  'blush',
];

function poseForState(
  state: ReceptionistAvatarState,
  frame: number,
  output: number,
  input: number,
  reducedMotion: boolean
): Pose {
  const p: Pose = {
    ...REST,
    breath: frame,
    yaw: 0,
    headYaw: 32,
    open: 0.82,
    wide: 0.94,
    blush: 1.12,
  };
  const idlePhase = reducedMotion ? 0 : frame;
  const blink = idlePhase % 132;
  if (blink < 6) p.lids = Math.max(0.12, Math.abs(blink - 3) / 3);
  p.armL += -Math.sin(idlePhase * 0.05) * 2;
  p.armR += Math.sin(idlePhase * 0.05) * 2;
  p.tilt += Math.sin(idlePhase * 0.025) * 1.5;

  if (state === 'connecting') {
    p.armR = reducedMotion ? 112 : 122 + Math.sin(frame * 0.43) * 14;
    p.eyes = 'happy';
    p.open = 0.72;
  } else if (state === 'listening') {
    p.headYaw = 32 + (reducedMotion ? 4 : Math.sin(frame * 0.05) * 4 + input * 5);
    p.headPitch = input > 0.18 ? 2 : 0;
    p.tilt += 2;
    p.open = 0.3;
  } else if (state === 'thinking') {
    p.headYaw = 25 + (reducedMotion ? 0 : Math.sin(frame * 0.035) * 2);
    p.headPitch = 5;
    p.armR = 27;
    p.open = 0.1;
  } else if (state === 'speaking') {
    p.armR = reducedMotion ? 38 : 38 + Math.sin(frame * 0.1) * 8;
    p.armL = -22;
    p.headPitch = reducedMotion ? 0 : Math.sin(frame * 0.1) * 2;
    p.open = 0.08 + Math.min(1, output) * 0.92;
    p.wide = 0.35 + Math.min(1, output) * 0.55;
  } else if (state === 'error') {
    p.eyes = 'closed';
    p.headYaw = 32;
    p.headPitch = 6;
    p.tilt = 5;
    p.open = 0.03;
  }
  return p;
}

function blendPoses(from: Pose, to: Pose, amount: number): Pose {
  const blended = { ...(amount < 0.5 ? from : to) } as Pose;
  for (const field of FIELDS) {
    blended[field] =
      (from[field] as number) + ((to[field] as number) - (from[field] as number)) * amount;
  }
  blended.breath = to.breath;
  return blended;
}

/** A1 uses Kame's shared 3D rig; the booth state and live voice meters drive its acting. */
export function ReceptionistAvatar({ state, size = 160, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const poseRef = useRef<Pose>({
    ...REST,
    yaw: 0,
    headYaw: 32,
    open: 0.82,
    wide: 0.94,
    blush: 1.12,
  });
  const [currentPose, setCurrentPose] = useState(poseRef.current);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let request = 0;
    let lastFrame = 0;

    const animate = (now: number) => {
      if (now - lastFrame >= 1000 / 30) {
        lastFrame = now;
        const host = hostRef.current;
        const readLevel = (name: string) => {
          const value = Number.parseFloat(
            host ? getComputedStyle(host).getPropertyValue(name) : '0'
          );
          return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
        };
        const requestedFrame = Number.parseFloat(
          getComputedStyle(host!).getPropertyValue('--voice-frame')
        );
        const frame = reducedMotion
          ? 0
          : Number.isFinite(requestedFrame)
            ? requestedFrame
            : now * 0.03;
        const target = poseForState(
          stateRef.current,
          frame,
          readLevel('--voice-out'),
          readLevel('--voice-in'),
          reducedMotion
        );
        const next = blendPoses(
          poseRef.current,
          target,
          stateRef.current === 'speaking' ? 0.32 : 0.14
        );
        poseRef.current = next;
        setCurrentPose(next);
      }
      request = window.requestAnimationFrame(animate);
    };

    request = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(request);
  }, []);

  return (
    <div
      ref={hostRef}
      className={cn(
        'ring-primary/25 relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1',
        className
      )}
      style={{ width: size, height: size, backgroundColor: '#DDF7EB' }}
      aria-hidden
    >
      <Kame
        w={size}
        h={size}
        pose={currentPose}
        look={{ shadow: '#8c9a75', shadowOpacity: 0.18, bounce: '#e7f7e9', exposure: 0.72 }}
        framing="full"
        quality={1.5}
        headScale={1.2}
        grinScale={0.92}
        toeClaws
        palette={{
          skin: '#93E85E',
          skinDeep: '#65C24D',
          shell: '#8A321D',
          rim: '#AD4727',
          scute: '#A84021',
        }}
      />
    </div>
  );
}
