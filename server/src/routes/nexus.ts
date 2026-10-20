import { Router } from 'express';

type Episode = { number: string; title: string };
type NexusTitle = { malId: number; anilistId: number; episodes: Episode[] };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function normalizeNexusTitle(value: unknown, malId: number, now = Date.now()): NexusTitle {
  const data = record(value), mapping = record(data.mappings);
  if (mapping.mal_id !== malId || !Number.isSafeInteger(mapping.anilist_id) || Number(mapping.anilist_id) < 1) {
    throw new Error('No verified AniList match is available for this anime. Try another playback source.');
  }
  const episodes = Object.entries(record(data.episodes)).filter(([number, episode]) => {
    if (!/^[1-9]\d{0,4}$/.test(number)) return false;
    const item = record(episode);
    if (!Object.keys(item).length) return false;
    const date = item.airDateUtc || item.airDate || item.airdate;
    return typeof date !== 'string' || !Number.isFinite(Date.parse(date)) || Date.parse(date) <= now;
  }).map(([number, episode]) => {
    const titles = record(record(episode).title);
    return { number, title: typeof titles.en === 'string' && titles.en.trim() ? titles.en.slice(0, 250) : `Episode ${number}` };
  }).sort((a, b) => Number(a.number) - Number(b.number));
  return { malId, anilistId: Number(mapping.anilist_id), episodes };
}

// Only public ID/episode metadata passes through Vercel. Playback loads directly
// in the documented Movies Nexus iframe, without a Koto request or media proxy.
export function createNexusRouter(fetcher: typeof fetch = fetch) {
  const router = Router();
  const cache = new Map<number, { until: number; data: NexusTitle }>();
  const pending = new Map<number, Promise<NexusTitle>>();
  router.get('/:id', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!/^[1-9]\d{0,8}$/.test(req.params.id)) { res.status(400).json({ error: 'Invalid anime ID.' }); return; }
    const id = Number(req.params.id);
    try {
      const cached = cache.get(id);
      if (cached && cached.until > Date.now()) { res.json(cached.data); return; }
      let request = pending.get(id);
      if (!request) {
        if (pending.size >= 8) { res.status(503).json({ error: 'Anime mapping is busy. Please retry shortly.' }); return; }
        request = (async () => {
          const response = await fetcher(`https://api.ani.zip/mappings?mal_id=${id}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000), redirect: 'error' });
          if (!response.ok) throw new Error('Anime ID mapping is temporarily unavailable. Retry or choose another playback source.');
          const body = await response.text();
          if (body.length > 5_000_000) throw new Error('Unexpected anime mapping response.');
          const data = normalizeNexusTitle(JSON.parse(body), id);
          if (cache.size >= 100) cache.delete(cache.keys().next().value!);
          cache.set(id, { until: Date.now() + 300000, data });
          return data;
        })();
        pending.set(id, request);
        void request.finally(() => pending.delete(id)).catch(() => {});
      }
      res.json(await request);
    } catch (error) {
      res.status(502).json({ error: error instanceof Error && !(error instanceof SyntaxError) ? error.message : 'Could not load anime mapping. Please retry.' });
    }
  });
  return router;
}
export default createNexusRouter();
