import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRequire } from 'node:module';
const { createNexusRouter, normalizeNexusTitle } = createRequire(import.meta.url)('../server/dist/routes/nexus.js');

const payload = { mappings: { mal_id: 52991, anilist_id: 154587 }, episodes: {
  '2': { title: { en: 'Second episode' }, airDate: '2023-10-06' },
  '1': { title: { en: 'First episode' }, airDateUtc: '2023-09-29T14:00:00Z' },
  '3': { title: { en: 'Future episode' }, airDate: '2099-01-01' },
  'S1': { title: { en: 'Special' } },
  '4': null,
} };

async function withRouter(fetcher, run) {
  const app = express(); app.use('/api/nexus', createNexusRouter(fetcher));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  try { await run(`http://127.0.0.1:${server.address().port}/api/nexus`); }
  finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
}

test('Nexus uses verified AniList mapping and aired episode metadata, not MAL IDs or generated totals', () => {
  const result = normalizeNexusTitle(payload, 52991, Date.parse('2026-10-21'));
  assert.equal(result.anilistId, 154587);
  assert.deepEqual(result.episodes, [{ number: '1', title: 'First episode' }, { number: '2', title: 'Second episode' }]);
  for (const mappings of [{ mal_id: 1, anilist_id: 154587 }, { mal_id: 52991, anilist_id: null }, { mal_id: 52991, anilist_id: -1 }]) {
    assert.throws(() => normalizeNexusTitle({ ...payload, mappings }, 52991), /No verified AniList match/);
  }
});

test('Nexus validates IDs, caches metadata, and uses only the fixed metadata host', async () => {
  let calls = 0;
  await withRouter(async (url, options) => {
    calls++; assert.equal(url, 'https://api.ani.zip/mappings?mal_id=52991'); assert.equal(options.redirect, 'error');
    return Response.json(payload);
  }, async base => {
    for (const id of ['52991', '52991']) {
      const response = await fetch(`${base}/${id}`);
      assert.equal(response.status, 200); assert.equal((await response.json()).anilistId, 154587);
    }
    assert.equal(calls, 1);
    for (const id of ['nope', '0', '1.5', '1234567890']) assert.equal((await fetch(`${base}/${id}`)).status, 400);
    assert.equal(calls, 1);
  });
});

test('Nexus mapping errors remain retryable and do not leak upstream bodies', async () => {
  let calls = 0;
  await withRouter(async () => ++calls === 1 ? new Response('private details', { status: 403 }) : Response.json(payload), async base => {
    const first = await fetch(`${base}/52991`);
    assert.equal(first.status, 502); assert.doesNotMatch(await first.text(), /private details/);
    const second = await fetch(`${base}/52991`);
    assert.equal(second.status, 200); assert.equal(calls, 2);
  });
});

test('Nexus refuses mismatched seasons instead of embedding another anime', async () => {
  await withRouter(async () => Response.json({ ...payload, mappings: { mal_id: 1, anilist_id: 154587 } }), async base => {
    const response = await fetch(`${base}/52991`);
    assert.equal(response.status, 502); assert.match((await response.json()).error, /No verified AniList match/);
  });
});
