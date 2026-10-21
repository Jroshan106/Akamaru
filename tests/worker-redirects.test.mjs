import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createNexusRouter } = require('../server/dist/routes/nexus.js');
const { createAnimelokRouter } = require('../server/dist/routes/animelok.js');
const { createAnikotoRouter } = require('../server/dist/routes/anikoto.js');

test('Workers-compatible provider requests reject redirects without following or exposing them', async () => {
  const calls = [];
  const workerFetch = async (url, options) => {
    // Match Workers: redirect:error throws before a network request is sent.
    if (options.redirect === 'error') throw new TypeError('Invalid redirect value');
    assert.equal(options.redirect, 'manual');
    calls.push(url);
    return new Response('private redirect response', {
      status: 302, headers: { Location: 'https://untrusted.test/private-destination' },
    });
  };
  const app = express();
  app.use('/nexus', createNexusRouter(workerFetch));
  app.use('/animelok', createAnimelokRouter(workerFetch));
  app.use('/anikoto', createAnikotoRouter(workerFetch));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/nexus/52991', '/animelok/154587/1', '/anikoto/search?q=Frieren', '/anikoto/resolve/52991']) {
      const before = calls.length;
      const response = await fetch(base + path);
      assert.equal(response.status, 502);
      assert.equal(calls.length, before + 1);
      assert.equal(response.headers.get('location'), null);
      assert.doesNotMatch(await response.text(), /private redirect|untrusted\.test|Invalid redirect value/);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
