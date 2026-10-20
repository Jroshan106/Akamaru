import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createJikanRouter } = require('../server/dist/routes/jikan.js');

async function withProxy(fetcher, run, timeout = 1000, injectRoutingParameters = false) {
  const app = express();
  if (injectRoutingParameters) app.use((req, _res, next) => {
    req.query.path = req.path.replace(/^\/api\//, '');
    next();
  });
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
    assert.equal(target.origin, 'https://api.tenrai.org');
    assert.equal(target.pathname, '/v1/anime');
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
test('proxy rejects unsupported endpoints and malformed supported filters', async () => {
  await withProxy(async () => { throw new Error('Must not fetch'); }, async base => {
    for (const path of ['/users', '/anime?page=-1', '/anime?limit=100', '/anime?q=a&q=b']) {
      const response = await fetch(base + path);
      assert.ok([400, 404].includes(response.status));
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  });
});

test('season rankings use the fixed catalog host and enforce safe limits', async () => {
  await withProxy(async url => {
    const target = new URL(url);
    assert.equal(target.origin, 'https://api.tenrai.org');
    assert.equal(target.pathname, '/v1/seasons/2026/fall');
    assert.equal(target.searchParams.get('sfw'), 'true');
    assert.equal(target.searchParams.get('limit'), '10');
    assert.equal(target.searchParams.get('order_by'), 'score');
    assert.equal(target.searchParams.get('sort'), 'desc');
    return Response.json({ data: [{ mal_id: 1, score: 9 }] });
  }, async base => {
    const result = await fetch(`${base}/seasons/2026/fall?limit=10&order_by=score&sort=desc&sfw=false`);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).data.length, 1);
    for (const path of ['/seasons/2026/fall?limit=100', '/seasons/2026/fall?page=0', '/seasons/2026/invalid', '/seasons/no/fall']) {
      assert.ok([400,404].includes((await fetch(base + path)).status));
    }
  });
});

test('Vercel rewrite captures do not reject valid requests or reach Jikan', async () => {
  const targets = [];
  await withProxy(async url => {
    const target = new URL(url);
    targets.push(target);
    assert.equal(target.origin, 'https://api.tenrai.org');
    assert.equal(target.searchParams.has('path'), false);
    assert.equal(target.searchParams.has('url'), false);
    return Response.json({ data: [] });
  }, async base => {
    for (const path of ['/genres/anime', '/top/anime?limit=1', '/anime?q=naruto&page=2&url=https://example.com', '/anime/1']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.deepEqual(await response.json(), { data: [] });
    }
    assert.equal(targets[2].searchParams.get('q'), 'naruto');
    assert.equal(targets[2].searchParams.get('page'), '2');
  }, 1000, true);
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
    assert.match((await response.json()).error, /server cannot reach the anime provider/);
  }, 20);
});

test('proxy permits only numeric anime relation endpoints', async () => {
 await withProxy(async url => { assert.equal(new URL(url).pathname,'/v1/anime/9253/relations'); return Response.json({data:[]}); }, async base => {
  assert.equal((await fetch(`${base}/anime/9253/relations`)).status,200);
  assert.equal((await fetch(`${base}/anime/nope/relations`)).status,404);
 });
});
