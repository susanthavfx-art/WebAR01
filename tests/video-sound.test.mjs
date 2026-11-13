import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playVideoWithSound } from '../src/lib/video-sound.js';

test('enables sound and starts at the beginning inside the gesture', async () => {
  const video = { muted: true, currentTime: 5, play() { assert.equal(this.muted, false); assert.equal(this.currentTime, 0); return Promise.resolve(); } };
  await playVideoWithSound(video);
  assert.equal(video.muted, false);
});
test('restores mute if playback is blocked or throws', async () => {
  for (const play of [() => Promise.reject(new Error('blocked')), () => { throw new Error('blocked'); }]) {
    const video = { muted: true, currentTime: 1, play };
    await assert.rejects(playVideoWithSound(video), /blocked/);
    assert.equal(video.muted, true);
  }
});
