import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../client/src/lib/episodePlayback.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { megaPlaysUrl, resolveEpisodePlayback } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const request = { malId: '52991', anilistId: 154587, episode: '2' };
const players = [{ language: 'English', url: 'https://ravok.buzz/video/episode-two' }];

test('Ravok is preferred and uses the AniList ID while the fallback uses the MAL ID', async () => {
  const result = await resolveEpisodePlayback(request, new AbortController().signal, async url => {
    assert.equal(url, '/api/animelok/154587/2'); return Response.json({ players });
  });
  assert.equal(result.provider, 'ravok'); assert.deepEqual(result.players, players);
  assert.equal(megaPlaysUrl('61967', '1'), 'https://megaplays.se/stream/mal/61967/1/sub');
});

test('missing sources, provider failures, and malformed responses automatically use MegaPlays', async () => {
  for (const fetcher of [
    async () => Response.json({ error: 'No Ravok' }, { status: 404 }),
    async () => Response.json({ error: 'Blocked' }, { status: 502 }),
    async () => Response.json({ players: [] }),
    async () => Response.json({ players: [{ language: 'Japanese', url: 'https://player.abyssplayer.com/old-no-subtitles' }] }),
    async () => Response.json({ players: [{ language: 'Other', url: 'https://evil.test/player' }] }),
    async () => new Response('<html>Unavailable</html>'),
    async () => { throw new Error('Network failure'); },
  ]) {
    const result = await resolveEpisodePlayback(request, new AbortController().signal, fetcher);
    assert.equal(result.provider, 'megaplays');
    assert.equal(result.players[0].url, 'https://megaplays.se/stream/mal/52991/2/sub');
  }
});

test('missing AniList mapping can use the MAL player without requesting Ravok', async () => {
  const result = await resolveEpisodePlayback({ malId: '61967', episode: '1' }, new AbortController().signal, async () => { assert.fail('Ravok should not be called without an AniList ID'); });
  assert.equal(result.provider, 'megaplays'); assert.equal(result.players[0].url, megaPlaysUrl('61967', '1'));
});

test('retry rechecks Ravok with a fresh mapping and can recover from fallback', async () => {
  const result = await resolveEpisodePlayback({ ...request, refresh: true }, new AbortController().signal, async url => {
    assert.equal(url, '/api/animelok/154587/2?refresh=1'); return Response.json({ players });
  });
  assert.equal(result.provider, 'ravok');
});

test('cancelled requests never switch to a fallback for an episode the viewer has left', async () => {
  const controller = new AbortController();
  await assert.rejects(resolveEpisodePlayback(request, controller.signal, async () => {
    controller.abort(); throw new Error('Aborted fetch');
  }), error => error.name === 'AbortError');
  await assert.rejects(resolveEpisodePlayback(request, controller.signal), error => error.name === 'AbortError');
});

test('fallback URLs reject malformed IDs and episode values', () => {
  for (const [id, episode] of [['0', '1'], ['52991', '0'], ['52991', '1/sub?url=evil'], ['https://evil.test', '1'], ['52991', '1.5']]) assert.throws(() => megaPlaysUrl(id, episode), /valid anime and episode/);
});
