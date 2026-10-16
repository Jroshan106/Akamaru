import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createJikanRouter } = require('../server/dist/routes/jikan.js');

async function withProxy(fetcher, run, timeout = 1000) {
  const app = express();
  app.use('/api/jikan', createJikanRouter(fetcher, 0, timeout));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}/api/jikan`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('proxy forwards full query to fixed host and caches identical requests', async () => {
  let calls = 0;
  await withProxy(async url => {
    calls++;
    const target = new URL(url);
    assert.equal(target.origin, 'https://api.jikan.moe');
    assert.equal(target.pathname, '/v4/anime');
    assert.equal(target.searchParams.get('q'), 'one piece');
    assert.equal(target.searchParams.get('page'), '2');
    assert.equal(target.searchParams.get('sfw'), 'true');
    return Response.json({ data: [{ mal_id: 21 }], pagination: { has_next_page: true } });
  }, async base => {
    const responses = await Promise.all([fetch(`${base}/anime?q=one%20piece&page=2`), fetch(`${base}/anime?q=one%20piece&page=2`)]);
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data[0].mal_id, 21);
    }
    const cached = await fetch(`${base}/anime?page=2&q=one%20piece`);
    assert.match(cached.headers.get('cache-control'), /s-maxage=300/);
    assert.equal(calls, 1);
  });
});
test('proxy rejects unsupported endpoints, arbitrary targets, and invalid pages', async () => {
  await withProxy(async () => { throw new Error('Must not fetch'); }, async base => {
    for (const path of ['/users', '/anime?url=https://example.com', '/anime?page=-1', '/anime?limit=100', '/anime?q=a&q=b']) {
      const response = await fetch(base + path);
      assert.ok([400, 404].includes(response.status));
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  });
});
test('upstream rate limits remain retryable and are never cached', async () => {
  let calls = 0;
  await withProxy(async () => { calls++; return calls === 1 ? new Response('', { status: 429 }) : Response.json({ data: [] }); }, async base => {
    const response = await fetch(`${base}/top/anime`);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '60');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(`${base}/top/anime`)).status, 200);
  });
});
test('upstream timeout returns a useful 502 instead of hanging', async () => {
  await withProxy((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout')))), async base => {
    const response = await fetch(`${base}/anime/1`);
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /server cannot reach Jikan/);
  }, 20);
});
