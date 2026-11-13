import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleKeyframes, validateKeyframes } from '../src/lib/timeline.js';

const pose = (time, x, rotation, scale) => ({ time, position: [x, 0, 0], rotation: [0, rotation, 0], scale });
test('validates, sorts and deduplicates keyframes', () => {
  const keys = validateKeyframes([pose(2, 2, 90, 2), pose(0, 0, 0, 1), pose(2, 3, 180, 1), { time: -1 }]);
  assert.deepEqual(keys.map(k => k.time), [0, 2]);
  assert.equal(keys[1].position[0], 3);
});
test('interpolates, loops and clamps scrubbing', () => {
  const keys = [pose(0, 0, 0, 1), pose(2, 2, 90, 2)];
  assert.deepEqual(sampleKeyframes(keys, 1).position, [1, 0, 0]);
  assert.equal(sampleKeyframes(keys, 1).rotation[1], 45);
  assert.equal(sampleKeyframes(keys, 1).scale, 1.5);
  assert.equal(sampleKeyframes(keys, 3).position[0], 1);
  assert.equal(sampleKeyframes(keys, 3, false).position[0], 2);
  assert.equal(sampleKeyframes([], 0), null);
});
