import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { allowedPlayer, parseSearch, parseEpisodes, createAnikotoRouter } = require('../server/dist/routes/anikoto.js');

test('Anikoto accepts only HTTPS players on known hosts', () => {
  assert.equal(allowedPlayer('https://megaplay.buzz/stream/1'), true);
  for (const url of ['http://megaplay.buzz/1', 'https://megaplay.buzz.evil.test/1', 'https://user@megaplay.buzz/1', 'https://127.0.0.1/1', 'javascript:alert(1)']) assert.equal(allowedPlayer(url), false);
});
test('Provider search ignores external links and deduplicates episodes', () => {
  const wrap = inner => `<div class="ani items"><div class="item">${inner}</div></div>`;
  assert.deepEqual(parseSearch(wrap('<a class="name" href="/watch/example-123/ep-1">A &amp; B</a><a class="name" href="/watch/example-123/ep-2">A &amp; B</a><a class="name" href="https://evil.test/watch/bad">Bad</a>')), [{ slug: 'example-123', title: 'A & B' }]);
});
test('Episode parser keeps numbers, titles and language availability', () => {
  const data = parseEpisodes('<div class="episodes"><ul><li><a data-num="2" data-ids="b" data-dub="1"><span class="d-title">Second</span></a></li><li><a data-num="1" data-ids="a" data-sub="1"><span class="d-title">First &amp; Last</span></a></li></ul></div>');
  assert.equal(data[0].title, 'First & Last');
  assert.equal(data[0].sub, true);
  assert.equal(data[1].dub, true);
});
test('Player resolution uses only provider-returned IDs, rejects unsafe embed URLs', async () => {
  const calls = [];
  const mock = async url => {
    calls.push(url);
    let text;
    if (url.endsWith('/watch/example')) text = '<div class="watch-wrap" data-id="123"></div>';
    else if (url.includes('/ajax/episode/list/')) text = JSON.stringify({status:200,result:'<div class="episodes"><ul><li><a data-num="1" data-ids="abc"></a></li></ul></div>'});
    else if (url.includes('/ajax/server/list?')) text = JSON.stringify({status:200,result:'<div data-type="sub"><li data-link-id="player">HD-1</li></div>'});
    else text = JSON.stringify({status:200,result:{url:'https://evil.test/player'}});
    return new Response(text);
  };
  const app = express(); app.use('/api', createAnikotoRouter(mock));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const response = await fetch(`${base}/example/episodes/1/players`);
    const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.url, null);
    assert.equal(body.servers[0].language, 'sub');
    assert.ok(calls.every(url => url.startsWith('https://anikototv.to/')));
    const count = calls.length;
    assert.equal((await fetch(`${base}/example/episodes/nope/players`)).status, 400);
    assert.equal(calls.length, count);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
