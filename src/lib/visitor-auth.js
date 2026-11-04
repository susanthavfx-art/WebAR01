import { SUPABASE_DEFAULTS, normaliseProjectUrl } from './supabase';

// Visitor accounts deliberately use the build-time project, not mutable publishing
// settings. Changing a storage destination must never redirect login credentials.
const base = normaliseProjectUrl(SUPABASE_DEFAULTS.url);
const key = SUPABASE_DEFAULTS.anonKey;
const sessionKey = `wonderlab.visitor.session.${new URL(base).hostname}`;

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* handled below */ }
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || 'Could not connect. Please try again.');
  return data;
}
function storeSession(data) {
  const session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(Date.now() / 1000) + data.expires_in, user: data.user };
  localStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}
export function clearSession() { localStorage.removeItem(sessionKey); }
export async function getSession() {
  let session;
  try { session = JSON.parse(localStorage.getItem(sessionKey)); } catch { clearSession(); return null; }
  if (!session?.access_token || !session.refresh_token || !session.user?.id) return null;
  if (session.expires_at > Date.now() / 1000 + 60) return session;
  try {
    const fresh = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) });
    return storeSession(fresh);
  } catch (error) {
    // Keep the refresh token after network errors so a temporary outage does not log people out.
    throw new Error('Could not refresh your login. Check your connection or sign out and try again.');
  }
}
export async function sendCode(email) {
  return request('/auth/v1/otp', { method: 'POST', body: JSON.stringify({ email, create_user: true }) });
}
export async function verifyCode(email, token) {
  const data = await request('/auth/v1/verify', { method: 'POST', body: JSON.stringify({ email, token, type: 'email' }) });
  return storeSession(data);
}
export async function signOut() {
  try {
    const session = await getSession();
    if (session) await request('/auth/v1/logout', { method: 'POST', token: session.access_token });
  } finally { clearSession(); }
}
export async function getProfile(session) {
  const rows = await request(`/rest/v1/webar_visitor_profiles?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`, { token: session.access_token });
  return rows[0] || null;
}
export async function saveProfile(session, profile) {
  return request('/rest/v1/webar_visitor_profiles?on_conflict=user_id', { method: 'POST', token: session.access_token, headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ ...profile, user_id: session.user.id }) });
}
export async function recordOpen(session, publicationId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicationId || '')) return;
  return request('/rest/v1/webar_visitor_opens', { method: 'POST', token: session.access_token, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: session.user.id, publication_id: publicationId }) });
}
