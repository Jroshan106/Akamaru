import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const app = createRequire(import.meta.url)('../server/dist/app.js').default;

test('retired streaming sources and media gateways are no longer exposed', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/api/anikage/search?q=Frieren', '/api/anikage/media/m3u8/token', '/api/anikoto/resolve/52991', '/api/anikoto/search?q=Frieren']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'API route not found' });
    }
    assert.equal((await fetch(`${base}/api/nexus/nope`)).status, 400);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
