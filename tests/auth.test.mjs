import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRequire } from 'node:module';
const { createAuth } = createRequire(import.meta.url)('../server/dist/routes/auth.js');
const credentials = { username: 'owner', password: 'a-strong-test-password-only', secret: 'ab'.repeat(32) };

async function withAuth(run, initial = credentials) {
  let time = Date.now(), config = { ...initial };
  const app = express(); app.use(express.json());
  const auth = createAuth(() => config, () => time);
  app.use('/auth', auth.router); app.get('/private', auth.requireSession, (_req, res) => res.json({ private: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body = credentials, headers = {}) => fetch(base + path, { method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json', 'X-Akamaru-Request': 'auth', ...headers }, body: JSON.stringify(body) });
  try { await run({ base, post, advance: ms => { time += ms; }, rotate: value => { config = value; } }); }
  finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
}

test('single-account login protects data with signed, expiring HttpOnly sessions', async () => {
  await withAuth(async ({ base, post, advance }) => {
    assert.equal((await fetch(base + '/private')).status, 401);
    const wrong = await post('/auth/login', { username: 'wrong', password: 'wrong' });
    assert.equal(wrong.status, 401); assert.equal(wrong.headers.get('set-cookie'), null);
    const login = await post('/auth/login'); assert.equal(login.status, 200);
    const header = login.headers.getSetCookie()[0];
    assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/); assert.match(header, /Max-Age=43200/);
    assert.doesNotMatch(header, /owner|a-strong-test-password/);
    const cookie = header.split(';')[0];
    const request = async path => fetch(base + path, { headers: { Cookie: cookie } });
    assert.equal((await request('/private')).status, 200);
    assert.equal((await request('/private')).headers.get('cache-control'), 'private, no-store');
    assert.equal((await (await request('/auth/session')).json()).authenticated, true);
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a');
    assert.equal((await fetch(base + '/private', { headers: { Cookie: tampered } })).status, 401);
    advance(12 * 3600000 + 1);
    assert.equal((await request('/private')).status, 401);
  });
});

test('login and logout reject cross-origin writes; failed attempts are rate limited', async () => {
  await withAuth(async ({ post, advance }) => {
    assert.equal((await post('/auth/login', credentials, { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await post('/auth/logout', {}, { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await post('/auth/login', credentials, { 'X-Akamaru-Request': '' })).status, 403);
    for (let i = 0; i < 10; i++) assert.equal((await post('/auth/login', { username: 'owner', password: 'wrong' })).status, 401);
    const limited = await post('/auth/login'); assert.equal(limited.status, 429); assert.ok(limited.headers.get('retry-after'));
    advance(10 * 60000 + 1); assert.equal((await post('/auth/login')).status, 200);
    const logout = await post('/auth/logout', {}); assert.equal(logout.status, 200);
    assert.match(logout.headers.getSetCookie()[0], /Max-Age=0/);
  });
});

test('HTTPS sessions are Secure and credential rotation invalidates old sessions', async () => {
  await withAuth(async ({ base, post, rotate }) => {
    const login = await post('/auth/login', credentials, { Origin: base.replace('http:', 'https:') });
    assert.equal(login.status, 200); assert.match(login.headers.getSetCookie()[0], /Secure/);
    const cookie = login.headers.getSetCookie()[0].split(';')[0];
    rotate({ ...credentials, password: 'new-strong-password-only' });
    assert.equal((await fetch(base + '/private', { headers: { Cookie: cookie } })).status, 401);
  });
  await withAuth(async ({ base, post }) => {
    assert.equal((await fetch(base + '/private')).status, 503);
    assert.equal((await post('/auth/login')).status, 503);
    assert.equal((await (await fetch(base + '/auth/session')).json()).configured, false);
  }, { username: '', password: '', secret: '' });
});
