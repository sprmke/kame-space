import { SPEC } from './spec';

export type Eyes = 'open' | 'happy' | 'closed';
export type Prop = 'none' | 'receipt' | 'key' | 'phone' | 'coin';

export interface Pose {
  /** Arm angles in degrees (0 = straight down; right arm positive goes out and up). */
  armL: number;
  armR: number;
  /** Whole body lift in model units (a hop). */
  hop: number;
  /** Body turn in degrees, added to the model's default three-quarter yaw. */
  yaw: number;
  /** Head turn / nod / tilt, degrees. */
  headYaw: number;
  headPitch: number;
  tilt: number;
  eyes: Eyes;
  /** Eye openness 0..1 (blinks, sleepy). */
  lids: number;
  /** 0 = closed smile, >0 = open grin (talking, cheering). */
  open: number;
  /** Mouth width for speech shapes, 0..1. */
  wide: number;
  /** Cheek scale, 1 = default. */
  blush: number;
  /** Breathing phase input (frame); 0 freezes the body. */
  breath: number;
  /** What the right hand holds. */
  prop: Prop;
}

export const REST: Pose = {
  armL: SPEC.groups.armL.rest ?? -18,
  armR: SPEC.groups.armR.rest ?? 18,
  hop: 0,
  yaw: 0,
  headYaw: 0,
  headPitch: 0,
  tilt: 0,
  eyes: 'open',
  lids: 1,
  open: 0,
  wide: 0.5,
  blush: 1,
  breath: 0,
  prop: 'none',
};
