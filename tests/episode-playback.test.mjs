import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../client/src/lib/episodePlayback.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { allowedAnikotoPlayer, resolveEpisodePlayback } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const request = { malId: '52991', anilistId: 154587, episode: '2' };
const players = [{ language: 'Hindi', url: 'https://player.abyssplayer.com/episode-two' }];
const match = { malId: 52991, item: { slug: 'frieren-c6fbj' } };
const fallback = { language: 'sub', url: 'https://megaplay.buzz/stream/s-2/provider-episode/sub' };
function fallbackResponse(url) {
  if (url === '/api/anikoto/resolve/52991') return Response.json(match);
  assert.match(url, /^\/api\/anikoto\/frieren-c6fbj\/episodes\/2\/players(?:\?refresh=1)?$/);
  return Response.json(fallback);
}
test('Abyss is preferred without requesting Anikoto', async () => {
  const result = await resolveEpisodePlayback(request, new AbortController().signal, async url => {
    assert.equal(url, '/api/animelok/154587/2'); return Response.json({ players });
  });
  assert.equal(result.provider, 'abyss'); assert.deepEqual(result.players, players);
});
test('missing sources and Abyss failures resolve the exact Anikoto title and episode', async () => {
  for (const primary of [async () => Response.json({}, { status: 404 }), async () => Response.json({}, { status: 502 }), async () => Response.json({ players: [] }), async () => Response.json({ players: [{ language: 'Unsafe', url: 'https://evil.test/player' }] }), async () => { throw Error('offline'); }]) {
    const calls = [];
    const result = await resolveEpisodePlayback(request, new AbortController().signal, async url => {
      calls.push(url); return url.startsWith('/api/animelok/') ? primary() : fallbackResponse(url);
    });
    assert.equal(result.provider, 'anikoto'); assert.equal(result.players[0].url, fallback.url);
    assert.deepEqual(calls.slice(1), ['/api/anikoto/resolve/52991', '/api/anikoto/frieren-c6fbj/episodes/2/players']);
  }
});
test('missing AniList mapping still uses the MAL identity for Anikoto resolution', async () => {
  const result = await resolveEpisodePlayback({ malId: '52991', episode: '2' }, new AbortController().signal, async url => { assert.ok(!url.includes('/animelok/')); return fallbackResponse(url); });
  assert.equal(result.provider, 'anikoto');
});

test('Anikoto returns a validated episode list for the shared sidebar', async () => {
  const result = await resolveEpisodePlayback({ malId: '52991', episode: '2' }, new AbortController().signal, async url =>
    url.includes('/resolve/') ? Response.json(match) : Response.json({ ...fallback, episodes: [
      { number: '2', title: 'Second' }, { number: '1', title: '' }, { number: '2', title: 'Second' },
      { number: '3', title: null }, { number: '0', title: 'Invalid' }, { number: '1/sub', title: 'Invalid' }, null,
    ] }));
  assert.deepEqual(result.episodes, [
    { number: '1', title: 'Episode 1' }, { number: '2', title: 'Second' }, { number: '3', title: 'Episode 3' },
  ]);
});
test('fallback failures and ambiguous matches show errors instead of mounting an invalid player', async () => {
  for (const response of [Response.json({ error: 'No unambiguous match' }, { status: 404 }), Response.json({ malId: 59978, item: { slug: 'wrong-season' } }), Response.json({ malId: 52991, item: { slug: '../other' } }), new Response('<html>Failure</html>')]) {
    await assert.rejects(resolveEpisodePlayback({ ...request, anilistId: undefined }, new AbortController().signal, async () => response));
  }
  await assert.rejects(resolveEpisodePlayback({ ...request, anilistId: undefined }, new AbortController().signal, async url => url.includes('/resolve/') ? Response.json(match) : Response.json({ url: 'https://evil.test/player' })), /No compatible Anikoto/);
});
test('retry refreshes Anikoto player resolution and can recover to Abyss', async () => {
  const calls = [];
  await resolveEpisodePlayback({ ...request, refresh: true }, new AbortController().signal, async url => { calls.push(url); return url.includes('/animelok/') ? Response.json({}, { status: 404 }) : fallbackResponse(url); });
  assert.ok(calls.includes('/api/anikoto/frieren-c6fbj/episodes/2/players?refresh=1'));
  const recovered = await resolveEpisodePlayback({ ...request, refresh: true }, new AbortController().signal, async url => { assert.equal(url, '/api/animelok/154587/2?refresh=1'); return Response.json({ players }); });
  assert.equal(recovered.provider, 'abyss');
});
test('cancelled navigation does not begin or mount an Anikoto fallback', async () => {
  const controller = new AbortController();
  await assert.rejects(resolveEpisodePlayback(request, controller.signal, async () => { controller.abort(); throw Error('aborted'); }), error => error.name === 'AbortError');
  await assert.rejects(resolveEpisodePlayback(request, controller.signal), error => error.name === 'AbortError');
});
test('Anikoto embeds allow only approved HTTPS hosts and reject the retired MegaPlays host', () => {
  assert.equal(allowedAnikotoPlayer(fallback.url), true);
  for (const url of ['https://megaplays.se/stream/mal/52991/2/sub', 'https://megaplay.buzz.evil.test/player', 'https://user@megaplay.buzz/player', 'http://megaplay.buzz/player', 'https://megaplay.buzz:1234/player']) assert.equal(allowedAnikotoPlayer(url), false);
});
test('invalid anime and episode values never reach a provider', async () => {
  for (const [malId, episode] of [['0', '1'], ['52991', '0'], ['52991', '1/sub?url=evil'], ['https://evil.test', '1'], ['52991', '1.5']]) await assert.rejects(resolveEpisodePlayback({ malId, episode }, new AbortController().signal, async () => assert.fail('No request expected')), /valid anime and episode/);
});


test('manual Anikoto selection resolves the requested dub without calling Abyss', async () => {
  const result = await resolveEpisodePlayback({ ...request, provider: 'anikoto', language: 'dub' }, new AbortController().signal, async url => {
    assert.ok(!url.includes('/animelok/'));
    if (url.includes('/resolve/')) return Response.json(match);
    assert.equal(url, '/api/anikoto/frieren-c6fbj/episodes/2/players?language=dub');
    return Response.json({ ...fallback, language: 'dub', languages: ['sub', 'dub'] });
  });
  assert.equal(result.provider, 'anikoto');
  assert.equal(result.audio, 'dub');
  assert.deepEqual(result.languages, ['sub', 'dub']);
});

test('Anikoto failure automatically switches to Abyss, while aborts stop fallback', async () => {
  const calls = [];
  const result = await resolveEpisodePlayback({ ...request, provider: 'anikoto' }, new AbortController().signal, async url => {
    calls.push(url); return url.includes('/animelok/') ? Response.json({ players }) : Response.json({ error: 'No matching anime' }, { status: 404 });
  });
  assert.equal(result.provider, 'abyss');
  assert.equal(result.fallbackFrom, 'anikoto');
  assert.equal(calls.at(-1), '/api/animelok/154587/2');
  const controller = new AbortController();
  await assert.rejects(resolveEpisodePlayback({ ...request, provider: 'anikoto' }, controller.signal, async () => { controller.abort(); throw Error('aborted'); }), e => e.name === 'AbortError');
});
