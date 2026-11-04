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
  assert.deepEqual(parseSearch(wrap('<a class="name" href="/watch/example-123/ep-1">A &amp; B</a><a class="name" href="/watch/example-123/ep-2">A &amp; B</a><a class="name" href="https://evil.test/watch/bad">Bad</a>')), [{ slug: 'example-123', title: 'A & B', alternateTitle: '' }]);
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
    assert.deepEqual(body.episodes, [{ number: '1', title: '' }]);
    assert.ok(calls.every(url => url.startsWith('https://anikototv.to/')));
    const count = calls.length;
    assert.equal((await fetch(`${base}/example/episodes/nope/players`)).status, 400);
    assert.equal(calls.length, count);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('Player response preserves valid intro timing and rejects malformed intervals', async () => {
  for (const [intro, expected] of [[[0, 89], [0, 89]], [[20, 10], null], [[-1, 90], null], [['0', 90], null], [undefined, null]]) {
    const mock = async url => {
      if (url.endsWith('/watch/example')) return new Response('<div class="watch-wrap" data-id="123"></div>');
      let result;
      if (url.includes('/ajax/episode/list/')) result = '<div class="episodes"><ul><li><a data-num="1" data-ids="abc"></a></li></ul></div>';
      else if (url.includes('/ajax/server/list?')) result = '<div data-type="sub"><li data-link-id="player">HD-1</li></div>';
      else result = {url: 'https://megaplay.buzz/stream/1', skip_data: {intro}};
      return new Response(JSON.stringify({status: 200, result}));
    };
    const app = express(); app.use('/api', createAnikotoRouter(mock));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/example/episodes/1/players`);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).intro, expected);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});

test('ID resolver uses catalog aliases and refuses ambiguous title matches', async () => {
 for (const ambiguous of [false,true]) {
  const mock=async url=>url.startsWith('https://api.tenrai.org/') ? Response.json({data:{title:'Original Title',title_english:'English Title'}}) : new Response(`<div class="ani items"><div class="item"><a class="name" data-jp="Original Title" href="/watch/correct-id">English Title</a>${ambiguous ? '<a class="name" href="/watch/other-id">English Title</a>' : ''}</div></div>`);
  const app=express();app.use('/api',createAnikotoRouter(mock));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try { const response=await fetch(`http://127.0.0.1:${server.address().port}/api/resolve/9253`); assert.equal(response.status,ambiguous ? 404 : 200);if(!ambiguous)assert.equal((await response.json()).item.slug,'correct-id'); }
  finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
 }
});


test('Anikoto language choice selects dub and rejects invalid language', async () => {
  const mock = async url => {
    if (url.endsWith('/watch/example')) return new Response('<div class="watch-wrap" data-id="123"></div>');
    let result;
    if (url.includes('/ajax/episode/list/')) result = '<div class="episodes"><ul><li><a data-num="1" data-ids="abc"></a></li></ul></div>';
    else if (url.includes('/ajax/server/list?')) result = '<div data-type="sub"><li data-link-id="sub-id">Sub</li></div><div data-type="dub"><li data-link-id="dub-id">Dub</li></div>';
    else { assert.ok(url.endsWith('get=dub-id')); result = { url: 'https://megaplay.buzz/dub' }; }
    return Response.json({ status: 200, result });
  };
  const app = express(); app.use('/api', createAnikotoRouter(mock));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/example/episodes/1/players`;
    const response = await fetch(`${base}?language=dub`); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.language, 'dub');
    assert.deepEqual(body.languages, ['sub', 'dub']); assert.equal(body.url, 'https://megaplay.buzz/dub');
    assert.equal((await fetch(`${base}?language=other`)).status, 400);
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});

async function withResolver(fetcher, run) {
  const app = express();app.use('/api', createAnikotoRouter(fetcher));
  const server = app.listen(0, '127.0.0.1');await new Promise(r => server.once('listening', r));
  try { await run(`http://127.0.0.1:${server.address().port}/api`); }
  finally { server.closeAllConnections();await new Promise(r => server.close(r)); }
}
const steelResult = '<div class="ani items"><div class="item"><a class="name" data-jp="Steel Ball Run: JoJo no Kimyou na Bouken" href="/watch/steel-ball-run-rbdlc/ep-1">Steel Ball Run: JoJo’s Bizarre Adventure</a><a class="name" href="/watch/steel-ball-run-second-stage">Steel Ball Run: JoJo’s Bizarre Adventure 2nd Stage</a></div></div>';
test('Steel Ball Run resolves through verified mapping titles when catalog lookup is limited', async () => {
  let metadataCalls = 0;
  await withResolver(async (url, options) => {
    assert.equal(options.redirect, 'manual');
    if (url.startsWith('https://api.tenrai.org/')) { metadataCalls++;return new Response('', { status: 429 }); }
    if (url.startsWith('https://api.ani.zip/')) { metadataCalls++;return Response.json({ mappings: { mal_id: 61469 }, titles: { 'x-jat': 'Steel Ball Run: JoJo no Kimyou na Bouken', en: "Steel Ball Run: JoJo's Bizarre Adventure" } }); }
    return new Response(steelResult);
  }, async base => {
    for (let i = 0; i < 2; i++) {
      const response = await fetch(base + '/resolve/61469');assert.equal(response.status, 200);
      const data = await response.json();assert.equal(data.malId, 61469);assert.equal(data.item.slug, 'steel-ball-run-rbdlc');
    }
    assert.equal(metadataCalls, 2, 'Subsequent episodes reuse the verified title lookup');
  });
});
test('resolver does not accept aliases from mismatched or unavailable metadata', async () => {
  for (const mappings of [{ mal_id: 999 }, undefined]) {
    let searched = false;
    await withResolver(async url => {
      if (url.includes('api.tenrai.org')) return new Response('', { status: 503 });
      if (url.includes('api.ani.zip')) return Response.json({ mappings, titles: { en: "Steel Ball Run: JoJo's Bizarre Adventure" } });
      searched = true;return new Response(steelResult);
    }, async base => { assert.equal((await fetch(base + '/resolve/61469')).status, 502);assert.equal(searched, false); });
  }
});
test('failed metadata lookups can recover on retry instead of poisoning the cache', async () => {
  let failing = true;
  await withResolver(async url => {
    if (url.includes('api.tenrai.org')) return failing ? new Response('', { status: 503 }) : Response.json({ data: { mal_id: 61469, title: 'Steel Ball Run: JoJo no Kimyou na Bouken' } });
    if (url.includes('api.ani.zip')) return new Response('', { status: 503 });
    return new Response(steelResult);
  }, async base => {
    assert.equal((await fetch(base + '/resolve/61469')).status, 502);failing = false;
    assert.equal((await fetch(base + '/resolve/61469')).status, 200);
  });
});

test('refresh invalidates both the title metadata and cached search results', async () => {
  let updated = false, metadataCalls = 0;
  await withResolver(async url => {
    if (url.includes('api.tenrai.org')) { metadataCalls++;return Response.json({ data: { mal_id: 61469, title: 'Same title' } }); }
    return new Response(`<div class="ani items"><div class="item"><a class="name" href="/watch/${updated ? 'new-result' : 'old-result'}">Same title</a></div></div>`);
  }, async base => {
    assert.equal((await (await fetch(base + '/resolve/61469')).json()).item.slug, 'old-result');updated = true;
    assert.equal((await (await fetch(base + '/resolve/61469?refresh=1')).json()).item.slug, 'new-result');
    assert.equal(metadataCalls, 2);
  });
});
