import { Router } from 'express';

type Player = { language: string; url: string };
export function abyssUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const url = new URL(value);
    return url.origin === 'https://player.abyssplayer.com' && !url.username && !url.password && !url.search && !url.hash && /^\/[\w-]{1,128}$/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}
export function normalizeAbyssPlayers(value: unknown, anilistId: number, episode: number): Player[] {
  const data = value as { success?: boolean; anilistId?: number; epNum?: number; servers?: { tracks?: { language?: unknown; link?: unknown }[]; language?: unknown; url?: unknown }[] } | null;
  if (!data || data.success !== true || data.anilistId !== anilistId || data.epNum !== episode || !Array.isArray(data.servers)) throw new Error('The provider returned an unexpected episode.');
  const players = new Map<string, Player>();
  for (const server of data.servers) {
    if (!server || typeof server !== 'object') continue;
    for (const track of Array.isArray(server.tracks) ? server.tracks : []) {
      const url = abyssUrl(track?.link);
      const language = typeof track?.language === 'string' ? track.language.trim().slice(0, 60) : '';
      if (url && language && !players.has(language.toLowerCase())) players.set(language.toLowerCase(), { language, url });
    }
    const url = abyssUrl(server.url);
    if (url && !players.size) players.set('multi-language', { language: 'Multi-language', url });
  }
  return [...players.values()].slice(0, 20);
}

// Resolve only provider-returned Abyss iframe links. No stream extraction,
// decryption, arbitrary destination forwarding, or video proxying is performed.
export function createAnimelokRouter(fetcher: typeof fetch = fetch) {
  const router = Router();
  const cache = new Map<string, { until: number; players: Player[] }>();
  const pending = new Map<string, Promise<Player[]>>();
  router.get('/:id/:episode', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!/^[1-9]\d{0,8}$/.test(req.params.id) || !/^[1-9]\d{0,4}$/.test(req.params.episode)) { res.status(400).json({ error: 'Invalid anime or episode ID.' }); return; }
    const key = `${req.params.id}/${req.params.episode}`;
    try {
      const cached = cache.get(key);
      if (cached && cached.until > Date.now() && req.query.refresh !== '1') { res.json({ players: cached.players }); return; }
      let request = pending.get(key);
      if (!request) {
        if (pending.size >= 8) { res.status(503).json({ error: 'The episode provider is busy. Please retry shortly.' }); return; }
        request = (async () => {
          const response = await fetcher(`https://animelok.cc/api/anilist/${key}`, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error(`The episode provider returned HTTP ${response.status}. Please retry later.`);
          const body = await response.text();
          if (body.length > 1_000_000) throw new Error('Unexpected episode response.');
          const players = normalizeAbyssPlayers(JSON.parse(body), Number(req.params.id), Number(req.params.episode));
          if (players.length) {
            if (cache.size >= 100) cache.delete(cache.keys().next().value!);
            cache.set(key, { until: Date.now() + 60000, players });
          } else cache.delete(key);
          return players;
        })();
        pending.set(key, request);
        void request.finally(() => pending.delete(key)).catch(() => {});
      }
      const players = await request;
      if (!players.length) { res.status(404).json({ error: 'No Abyss player is listed for this episode yet.' }); return; }
      res.json({ players });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error && !(error instanceof SyntaxError) ? error.message : 'Could not load the episode player. Please retry.' });
    }
  });
  return router;
}
export default createAnimelokRouter();
