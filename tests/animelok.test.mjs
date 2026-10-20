import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRequire } from 'node:module';
const { ravokUrl, normalizeRavokPlayers, createAnimelokRouter } = createRequire(import.meta.url)('../server/dist/routes/animelok.js');
const payload = { success: true, anilistId: 154587, epNum: 1, servers: [
  { url: 'https://flixcloud.cc/e/other', type: 'sub' },
  { url: 'https://ravok.buzz/video/4c12343400ce0c1454ad4bc3860602b9', type: 'dub' },
  { tracks: [
    { language: 'Tamil', link: 'https://player.abyssplayer.com/E-aqhQkoAa' },
    { language: 'English', link: 'https://player.abyssplayer.com/fsvUkVr8q' },
    { language: 'Japanese', link: 'https://player.abyssplayer.com/wUEgwahjs' },
    { language: 'Unsafe', link: 'https://evil.test/player' },
    { language: 'English', link: 'https://player.abyssplayer.com/duplicate' },
  ] },
] };
test('Ravok normalization selects the episode-specific multi-audio embed and rejects other servers', () => {
  const players = normalizeRavokPlayers(payload, 154587, 1);
  assert.deepEqual(players.map(p => p.language), ['Multi-audio']);
  assert.equal(players[0].url, 'https://ravok.buzz/video/4c12343400ce0c1454ad4bc3860602b9');
  assert.throws(() => normalizeRavokPlayers(payload, 154587, 2), /unexpected episode/);
  assert.throws(() => normalizeRavokPlayers(payload, 120377, 1), /unexpected episode/);
  for (const url of ['http://ravok.buzz/video/id', 'https://ravok.buzz.evil.test/video/id', 'https://user@ravok.buzz/video/id', 'https://ravok.buzz/video/id?next=evil', 'https://ravok.buzz:1234/video/id', 'https://ravok.buzz/other/id']) assert.equal(ravokUrl(url), null);
});
async function withRouter(fetcher, run) {
  const app = express(); app.use('/api/animelok', createAnimelokRouter(fetcher));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  try { await run(`http://127.0.0.1:${server.address().port}/api/animelok`); }
  finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
}
test('Ravok route validates episodes, caches successful mappings, and refreshes on retry', async () => {
  let calls = 0;
  await withRouter(async (url, options) => {
    calls++; assert.equal(url, 'https://animelok.cc/api/anilist/154587/1'); assert.equal(options.redirect, 'error'); return Response.json(payload);
  }, async base => {
    for (let i = 0; i < 2; i++) { const r = await fetch(`${base}/154587/1`); assert.equal(r.status, 200); assert.equal((await r.json()).players.length, 1); }
    assert.equal(calls, 1);
    assert.equal((await fetch(`${base}/154587/1?refresh=1`)).status, 200); assert.equal(calls, 2);
    for (const path of ['/0/1', '/154587/nope', '/154587/0', '/154587/1.5']) assert.equal((await fetch(base + path)).status, 400);
    assert.equal(calls, 2);
  });
});
test('missing Ravok streams do not fall back to a different provider and remain retryable', async () => {
  let calls = 0;
  await withRouter(async () => Response.json(++calls === 1 ? { ...payload, servers: [payload.servers[0]] } : payload), async base => {
    const first = await fetch(`${base}/154587/1`); assert.equal(first.status, 404); assert.match((await first.json()).error, /No Ravok player/);
    assert.equal((await fetch(`${base}/154587/1`)).status, 200); assert.equal(calls, 2);
  });
});
test('Ravok upstream failures return a useful error without leaking response bodies', async () => {
  await withRouter(async () => new Response('private upstream body', { status: 403 }), async base => {
    const response = await fetch(`${base}/154587/1`); assert.equal(response.status, 502);
    const body = await response.text(); assert.match(body, /HTTP 403/); assert.doesNotMatch(body, /private upstream body/);
  });
});
