import test from 'node:test';
import assert from 'node:assert/strict';
import { actions, neutral, sampleAction, ActionPlayer } from './motion.mjs';

for (const [name, { duration }] of Object.entries(actions)) {
  test(`${name}: neutral endpoints and bounded continuous joint motion`, () => {
    for (const strength of [0.6, 1, 1.5, 100, NaN]) {
      assert.deepEqual(sampleAction(name, 0, strength), neutral());
      assert.deepEqual(sampleAction(name, duration, strength), neutral());
      let prior = neutral();
      for (let frame = 1; frame <= Math.ceil(duration * 120); frame++) {
        const pose = sampleAction(name, frame / 120, strength);
        for (const [key, value] of Object.entries(pose)) {
          assert.ok(Number.isFinite(value), `${name}.${key} must be finite`);
          const limit = /Angle|Arm|Leg/.test(key) ? 0.08 : 6;
          assert.ok(Math.abs(value - prior[key]) < limit, `${name}.${key} jumps at frame ${frame}`);
        }
        prior = pose;
      }
    }
  });
}
test('interruptions preserve the current pose, then return through neutral', () => {
  const player = new ActionPlayer();
  player.play('sit', 0);
  const seated = player.sample(2, 1.5);
  player.play('jump', 2, 1.5);
  assert.deepEqual(player.sample(2, 1.5), seated);
  const halfway = player.sample(2.2, 1.5);
  player.play('think', 2.2, 1.5);
  assert.deepEqual(player.sample(2.2, 1.5), halfway);
  const rest = player.sample(2.65, 1.5);
  for (const key of Object.keys(rest)) assert.ok(Math.abs(rest[key] - neutral()[key]) < 1e-10);
  assert.equal(player.name, 'think');
});
test('sit moves hips continuously and jump returns to floor', () => {
  assert.ok(sampleAction('sit', 2).hipY > 25);
  assert.ok(sampleAction('sit', 0.3).leftLeg > 0);
  for (let t = 0; t < actions.sit.duration; t += 1 / 120) {
    const pose = sampleAction('sit', t);
    const floor = 958 + pose.hipY + 105 * Math.sin(pose.leftLeg) + 187 * Math.cos(pose.leftLeg);
    assert.ok(Math.abs(floor - 1145) < 1e-8);
  }
  assert.ok(sampleAction('jump', 1).lift > 90);
  assert.equal(sampleAction('jump', actions.jump.duration).lift, 0);
});
