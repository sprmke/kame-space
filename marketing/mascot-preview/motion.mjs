// Joint-space animation: only rigid translations and rotations of rendered parts.
export const actions = {
  idle: { label: 'Idle', duration: 4 },
  wave: { label: 'Wave', duration: 3.6 },
  laugh: { label: 'Laugh', duration: 3.2 },
  think: { label: 'Think', duration: 5 },
  sit: { label: 'Sit down', duration: 6 },
  jump: { label: 'Jump', duration: 2.8 },
  listen: { label: 'Listen', duration: 4.2 },
  celebrate: { label: 'Celebrate', duration: 4 },
};
export const ease = (x) => {
  const v = Math.max(0, Math.min(1, x));
  return v * v * v * (v * (v * 6 - 15) + 10);
};
export const neutral = () => ({
  bodyY: 0,
  hipY: 0,
  bodyAngle: 0,
  headY: 0,
  headAngle: 0,
  leftArm: -1.6,
  rightArm: 0,
  leftLeg: 0,
  rightLeg: 0,
  lift: 0,
  laugh: 0,
  eyeClose: 0,
});
export function blendPose(a, b, amount) {
  return Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + (b[k] - a[k]) * amount]));
}
export function sampleAction(name, time, strength = 1) {
  const result = neutral();
  const duration = actions[name]?.duration;
  if (!duration) throw new Error(`Unknown action: ${name}`);
  if (!Number.isFinite(time) || time <= 0 || time >= duration) return result;
  const s = Math.max(0.6, Math.min(1.5, Number.isFinite(strength) ? strength : 1));
  const e = ease(time / 0.7) * ease((duration - time) / 0.7);
  const beat = Math.sin(time * 2.4);
  result.bodyAngle = Math.sin(time * 1.5) * 0.012 * e * s;
  result.bodyY = (Math.cos(time * 2.1) - 1) * 2 * e;
  result.headAngle = Math.sin(time * 1.7) * 0.02 * e * s;
  switch (name) {
    case 'wave':
      result.leftArm += (1.6 + Math.sin(time * 8) * 0.14 * s) * e;
      result.headAngle -= 0.045 * e;
      break;
    case 'laugh':
      result.bodyY -= (1 - Math.cos(time * 14)) * 5 * e * s;
      result.headY -= (1 - Math.cos(time * 14 - 0.3)) * 3 * e;
      result.headAngle += 0.055 * e;
      result.leftArm += 0.22 * e;
      result.rightArm -= 0.16 * e;
      result.laugh = e;
      result.eyeClose = e * 0.7;
      break;
    case 'think':
      result.headAngle -= 0.1 * e;
      result.headY += 9 * e;
      result.rightArm += 2.25 * e;
      result.bodyAngle -= 0.015 * e;
      break;
    case 'sit':
      result.bodyY += 80 * e;
      result.leftLeg += 1.25 * e;
      result.rightLeg -= 1.25 * e;
      // Compensate the rotating foot's lowest corner to keep its floor height.
      result.hipY = 187 - (105 * Math.sin(result.leftLeg) + 187 * Math.cos(result.leftLeg));
      result.leftArm += 0.35 * e;
      result.rightArm -= 0.25 * e;
      result.headAngle += 0.035 * e;
      break;
    case 'jump': {
      const crouch = ease(time / 0.4) * (1 - ease((time - 0.4) / 0.25));
      const air = ease((time - 0.6) / 0.4) * (1 - ease((time - 1.05) / 0.5));
      const land = ease((time - 1.4) / 0.18) * (1 - ease((time - 1.58) / 0.45));
      result.bodyY += crouch * 22 + land * 15;
      result.lift = air * 100;
      result.leftArm += air * 1.3;
      result.rightArm -= air * 0.65;
      result.leftLeg += air * 0.12;
      result.rightLeg -= air * 0.12;
      result.headY += crouch * 8 + land * 5;
      break;
    }
    case 'listen':
      result.headAngle += 0.075 * e;
      result.headY += (1 - Math.cos(time * 3)) * 4 * e;
      result.rightArm += 0.1 * e;
      break;
    case 'celebrate':
      result.leftArm += (1.6 + beat * 0.1 * s) * e;
      result.rightArm -= (1.5 + beat * 0.1 * s) * e;
      result.bodyY -= (1 - Math.cos(time * 8)) * 6 * e * s;
      result.headAngle += beat * 0.04 * e;
      result.laugh = e * 0.7;
      break;
  }
  return result;
}

// Interruptions return through neutral before the next action. Interpolate
// joint values, never image opacity, so there are no doubled faces or limbs.
export class ActionPlayer {
  constructor() {
    this.name = 'idle';
    this.started = 0;
    this.transition = null;
  }
  sample(now, strength = 1) {
    if (this.transition) {
      const t = (now - this.transition.started) / 0.45;
      if (t < 1 - 1e-9) return blendPose(this.transition.from, neutral(), ease(t));
      this.name = this.transition.next;
      this.started = this.transition.started + 0.45;
      this.transition = null;
    }
    let time = now - this.started;
    if (time >= actions[this.name].duration) {
      this.name = 'idle';
      this.started = now;
      time = 0;
    }
    return sampleAction(this.name, time, strength);
  }
  play(name, now, strength = 1) {
    if (!actions[name]) throw new Error(`Unknown action: ${name}`);
    const from = this.sample(now, strength);
    this.transition = { from, started: now, next: name };
  }
}
