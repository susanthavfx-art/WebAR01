import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('video objects survive scene validation with safe local and published references', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { validateScene } = await vite.ssrLoadModule('/src/lib/projects.js');
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const object = { id: 'video-1', assetId: 'media:video', name: 'Birthday', video: { url: `local:${id}`, aspect: 1.5 }, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };
    const scene = validateScene({ objects: [object] });
    assert.equal(scene.objects[0].video.url, `local:${id}`);
    assert.equal(scene.objects[0].video.aspect, 1.5);
    object.video.url = `published/${id}/files/${id}.webm`;
    assert.equal(validateScene({ objects: [object] }).objects[0].video.url, object.video.url);
    object.video.url = 'javascript:alert(1)';
    assert.equal(validateScene({ objects: [object] }).objects.length, 0);
  } finally { await vite.close(); }
});
