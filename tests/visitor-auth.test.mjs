import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('visitor OTP, private profile, open tracking and sign-out use the expected requests', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    if (url.includes('/auth/v1/verify')) return new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: 'test-user' } }), { status: 200 });
    if (url.includes('/rest/v1/webar_visitor_profiles') && options.method !== 'POST') return new Response(JSON.stringify([{ user_id: 'test-user', full_name: 'Visitor' }]), { status: 200 });
    return new Response(null, { status: 204 });
  };
  try {
    const auth = await vite.ssrLoadModule('/src/lib/visitor-auth.js');
    assert.equal(await auth.getSession(), null);
    await auth.sendCode('visitor@example.com');
    assert.deepEqual(JSON.parse(requests.at(-1).body), { email: 'visitor@example.com', create_user: true });
    const session = await auth.verifyCode('visitor@example.com', '12345678');
    assert.equal((await auth.getSession()).user.id, 'test-user');
    assert.equal((await auth.getProfile(session)).full_name, 'Visitor');
    await auth.saveProfile(session, { full_name: 'Visitor', whatsapp_marketing: false });
    assert.equal(requests.at(-1).headers.Authorization, 'Bearer access');
    assert.equal(JSON.parse(requests.at(-1).body).user_id, 'test-user');
    const before = requests.length;
    await auth.recordOpen(session, 'invalid');
    assert.equal(requests.length, before);
    await auth.recordOpen(session, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    assert.match(requests.at(-1).url, /webar_visitor_opens/);
    await auth.signOut();
    assert.equal(await auth.getSession(), null);
  } finally { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; await vite.close(); }
});
