import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let server;
let base;
before(async () => {
  server = createServer(require('../api/index.js'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});
test('Vercel entry serves catalog JSON without starting the standalone server', async () => {
  const response = await fetch(`${base}/api/anime`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const catalog = await response.json();
  assert.equal(catalog.length, 6);
  assert.equal(catalog[0].id, 'attack-on-titan');
});
test('Vercel entry handles nested routes, filters, and JSON 404s', async () => {
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const filtered = await (await fetch(`${base}/api/anime?search=titan`)).json();
  assert.equal(filtered.length, 1);
  const episode = await (await fetch(`${base}/api/anime/attack-on-titan/episodes/aot-1`)).json();
  assert.equal(episode.episode.number, 1);
  const missing = await fetch(`${base}/api/unknown`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'API route not found' });
});
