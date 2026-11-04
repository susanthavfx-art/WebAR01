import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('Apps Script saves a safe row once and redirects only to the configured AR viewer', async () => {
  const rows = [['headers']];
  const sheet = { getLastRow: () => rows.length, getRange: (_r, _c, count) => ({ getValues: () => rows.slice(1, count + 1).map(r => [r[6]]) }), appendRow: row => rows.push(row) };
  let released = 0;
  const context = vm.createContext({ SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush: () => {} }, LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => { released++; } }) }, Date, encodeURIComponent });
  vm.runInContext(await readFile('integrations/google-apps-script/Code.gs', 'utf8'), context);
  const data = { publicationId: 'abfb8ba5-ef91-4134-915c-2b175ddf12af', state: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', camera: '1', name: '=1+1', job: 'Parent', whatsapp: '077 123 4567', adult: true, marketing: false };
  const result = context.submitVisitor(data);
  assert.match(result, /^https:\/\/susanthavfx-art\.github\.io\/WebAR01\/#page=collection/);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], "'=1+1");
  assert.equal(rows[1][3], "'+94771234567");
  assert.equal(rows[1][4], 'No');
  context.submitVisitor(data);
  assert.equal(rows.length, 2, 'retries must not append duplicate rows');
  assert.equal(released, 2);
  assert.throws(() => context.submitVisitor({ ...data, adult: false }));
  assert.throws(() => context.submitVisitor({ ...data, whatsapp: 'not a number' }));
  assert.throws(() => context.submitVisitor({ ...data, publicationId: 'invalid' }));
  assert.equal(rows.length, 2);
});
