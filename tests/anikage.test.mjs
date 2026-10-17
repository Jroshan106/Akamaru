import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRequire } from 'node:module';
const { mediaUrl, createAnikageRouter, rewritePlaylist } = createRequire(import.meta.url)('../server/dist/routes/anikage.js');

test('playlist rewriting covers relative variants, encryption keys and rejects foreign hosts', () => {
  const source = 'https://og.bakayaro.live/m3u8/master';
  const playlist = '#EXTM3U\nvariant\n#EXT-X-KEY:METHOD=AES-128,URI="/stream/key"\nhttps://og.bakayaro.live/stream/segment\n';
  const result = rewritePlaylist(playlist, source);
  assert.match(result, /\/api\/anikage\/media\/m3u8\/variant/);
  assert.match(result, /URI="\/api\/anikage\/media\/stream\/key"/);
  assert.match(result, /\/api\/anikage\/media\/stream\/segment/);
  for (const value of ['https://evil.test/video', 'https://user@og.bakayaro.live/stream/secret', 'http://127.0.0.1/file']) {
    assert.throws(() => rewritePlaylist(`#EXTM3U\n${value}`, source));
  }
  assert.throws(() => rewritePlaylist('<html>Error</html>', source));
});

test('Koto catalog preserves season IDs and actual episode numbers', async () => {
  const calls = [];
  const app = express();
  app.use('/api', createAnikageRouter(async (url, options) => {
    assert.equal(options.redirect, 'error'); calls.push(url);
    return new Response(JSON.stringify(url.includes('/browse?') ? { data: [
      { slug: 'season1', malId: 52991, title: { english: 'Frieren' }, year: 2023 },
      { slug: 'season2', malId: 59978, title: { english: 'Frieren Season 2' }, year: 2026 },
    ] } : [{ number: 2, title: 'Second' }, { number: 1, title: 'First' }, { number: null }]));
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const data = await (await fetch(`${base}/search?q=Frieren`)).json();
    assert.deepEqual(data.items.map(i => i.malId), [52991, 59978]);
    await fetch(`${base}/search?q=Frieren`);
    assert.equal(calls.length, 1, 'identical metadata is cached');
    const episodes = await (await fetch(`${base}/season1/episodes`)).json();
    assert.deepEqual(episodes.episodes.map(e => e.number), ['1', '2']);
    assert.equal((await fetch(`${base}/search?q[]=bad`)).status, 400);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('direct media URLs stay on the approved media service', () => {
  assert.equal(mediaUrl('abc_123', true), 'https://og.bakayaro.live/m3u8/abc_123');
  for (const value of ['https://evil.test/file', 'http://og.bakayaro.live/a', 'https://user@og.bakayaro.live/a', '../a', null]) assert.equal(mediaUrl(value), null);
});
test('direct source route validates inputs and normalizes streams and subtitles', async () => {
  const calls = [];
  const app = express();
  app.use('/api', createAnikageRouter(async url => {
    calls.push(url);
    return new Response(JSON.stringify({ sources: [{ url: 'video_token', isM3U8: true }], subtitles: [{ file: 'captions_token', label: 'English', kind: 'captions', default: true }, { file: 'https://evil.test/file', kind: 'captions' }], intro: {start: 63, end: 153} }));
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const response = await fetch(`${base}/Z78KNV8HKq/1?lang=dub`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.url, 'https://og.bakayaro.live/m3u8/video_token');
    assert.equal(data.tracks.length, 1);
    assert.deepEqual(data.intro, [63,153]);
    assert.match(calls[0], /^https:\/\/anikage\.cc\/api\/media\/anime\/Z78KNV8HKq\/episodes\/1\/sources\?provider=koto&lang=dub&server=koto$/);
    assert.equal((await fetch(`${base}/valid/nope`)).status, 400);
    assert.equal((await fetch(`${base}/valid/1?lang=other`)).status, 400);
    assert.equal(calls.length, 1);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('media proxy rewrites m3u8 playlist links to internal proxy endpoints', async () => {
  const app = express();
  app.use('/api', createAnikageRouter(async (url, init) => {
    assert.equal(init?.headers?.Referer, 'https://anikage.cc/');
    if (url.includes('/m3u8/sample_token')) {
      return new Response('#EXTM3U\nhttps://og.bakayaro.live/m3u8/variant_token\nhttps://og.bakayaro.live/stream/segment_token', {
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
      });
    }
    if (url.includes('/stream/subtitle_token')) {
      return new Response('WEBVTT\n00:00.000 --> 00:02.000\nHello world', {
        headers: { 'Content-Type': 'image/jpeg' },
      });
    }
    return new Response('not found', { status: 404 });
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const m3u8Res = await fetch(`${base}/media/m3u8/sample_token`);
    assert.equal(m3u8Res.status, 200);
    const m3u8Text = await m3u8Res.text();
    assert.match(m3u8Text, /\/api\/anikage\/media\/m3u8\/variant_token/);
    assert.match(m3u8Text, /\/api\/anikage\/media\/stream\/segment_token/);

    const subRes = await fetch(`${base}/media/subtitles/subtitle_token`);
    assert.equal(subRes.status, 200);
    assert.equal(subRes.headers.get('content-type'), 'text/vtt; charset=utf-8');
    const subText = await subRes.text();
    assert.match(subText, /WEBVTT/);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
