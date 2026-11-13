import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGroups } from '../src/lib/custom-groups.js';

const model = { id: 'upload-1234-abcd', file: 'uploads/1234-abcd.glb', name: 'Lion' };
test('retains custom groups and unique uploaded models', () => {
  const groups = validateGroups([{ id: 'group-1', name: ' Animals ', models: [model, model] }]);
  assert.equal(groups[0].name, 'Animals');
  assert.equal(groups[0].models.length, 1);
  assert.equal(groups[0].models[0].file, model.file);
});
test('rejects built-in names, duplicates and unsafe model paths', () => {
  const groups = validateGroups([
    { id: 'one', name: 'Nature', models: [] },
    { id: 'two', name: 'Animals', models: [{ ...model, file: '../evil.glb' }] },
    { id: 'three', name: 'animals', models: [] },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].models, []);
});
