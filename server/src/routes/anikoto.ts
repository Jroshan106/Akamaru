import { Router } from 'express';
import { load } from 'cheerio';

// Provider endpoints/selectors documented by yuzono/anime-extensions (AnikotoTheme).
// Only public episode listings and provider-returned embeds are used.
const origin = 'https://anikototv.to';
const slugPattern = /^[a-z0-9][a-z0-9-]{0,180}$/;
export function allowedPlayer(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['megaplay.buzz', 'megaplay.cc', 'mewcdn.online'].includes(url.hostname);
  } catch { return false; }
}
export function parseSearch(html: string) {
  const $ = load(html);
  const items = new Map<string, { slug: string; title: string }>();
  $('div.ani.items > div.item a.name').each((_, el) => {
    const a = $(el);
    const href = a.attr('href') || '';
    try {
      const url = new URL(href, origin);
      const slug = url.pathname.match(/^\/watch\/([a-z0-9-]+)(?:\/ep-[\d.]+)?\/?$/)?.[1];
      if (url.origin === origin && slug && slugPattern.test(slug)) {
        items.set(slug, { slug, title: a.text().trim() });
      }
    } catch { /* Ignore malformed upstream links. */ }
  });
  return [...items.values()];
}
export function parseEpisodes(html: string) {
  const $ = load(html);
  return $('div.episodes ul > li > a').toArray().map(el => {
    const a = $(el);
    return { number: a.attr('data-num') || '', title: a.find('.d-title').text().trim() || a.parent().attr('title') || '',
      sub: a.attr('data-sub') === '1', dub: a.attr('data-dub') === '1', ids: a.attr('data-ids') || '' };
  }).filter(e => /^\d+(?:\.\d+)?$/.test(e.number) && e.ids.length > 0)
    .sort((a, b) => Number(a.number) - Number(b.number));
}

export function createAnikotoRouter(fetcher: typeof fetch = fetch) {
  const router = Router();
  const cache = new Map<string, { text: string; until: number }>();
  const pending = new Map<string, Promise<string>>();
  async function request(path: string, referer = `${origin}/`) {
    const key = `${path}|${referer}`;
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.text;
    const running = pending.get(key);
    if (running) return running;
    if (pending.size >= 6) throw new Error('Anikoto is busy. Please try again shortly.');
    const work = (async () => {
      const response = await fetcher(`${origin}${path}`, { redirect: 'error', signal: AbortSignal.timeout(7000),
        headers: { Referer: referer, 'X-Requested-With': 'XMLHttpRequest', Accept: 'text/html, application/json' } });
      if (!response.ok) throw new Error(`Anikoto is unavailable (HTTP ${response.status}). Try again later.`);
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error('Anikoto returned an unexpected response.');
      if (cache.size >= 80) cache.delete(cache.keys().next().value!);
      cache.set(key, { text, until: Date.now() + 120000 });
      return text;
    })();
    pending.set(key, work);
    try { return await work; } finally { pending.delete(key); }
  }
  function result(text: string) {
    const json = JSON.parse(text);
    if (json.status !== 200 || !json.result) throw new Error('Anikoto could not load this request.');
    return json.result;
  }
  async function episodes(slug: string) {
    const referer = `${origin}/watch/${slug}`;
    const $ = load(await request(`/watch/${slug}`));
    const id = $('.watch-wrap[data-id]').attr('data-id');
    if (!id || !/^\d+$/.test(id)) throw new Error('This Anikoto title is unavailable. Choose another result.');
    const html = result(await request(`/ajax/episode/list/${id}`, referer));
    if (typeof html !== 'string') throw new Error('Unexpected episode response.');
    return parseEpisodes(html);
  }
  router.get('/search', async (req, res) => {
    const q = req.query.q;
    if (typeof q !== 'string' || !q.trim() || q.length > 180) { res.status(400).json({ error: 'Enter an anime title.' }); return; }
    try { res.json({ items: parseSearch(await request(`/filter?keyword=${encodeURIComponent(q.trim())}`)) }); }
    catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Anikoto is unavailable.' }); }
  });
  router.get('/:slug/episodes', async (req, res) => {
    if (!slugPattern.test(req.params.slug)) { res.status(400).json({ error: 'Invalid title.' }); return; }
    try { res.json({ episodes: (await episodes(req.params.slug)).map(({ ids, ...episode }) => episode) }); }
    catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Episodes unavailable.' }); }
  });
  router.get('/:slug/episodes/:number/players', async (req, res) => {
    const { slug, number } = req.params;
    if (!slugPattern.test(slug) || !/^\d+(?:\.\d+)?$/.test(number)) { res.status(400).json({ error: 'Invalid episode.' }); return; }
    try {
      const episode = (await episodes(slug)).find(e => e.number === number);
      if (!episode) { res.status(404).json({ error: 'Episode not found.' }); return; }
      const referer = `${origin}/watch/${slug}/ep-${number}`;
      const html = result(await request(`/ajax/server/list?servers=${encodeURIComponent(episode.ids)}`, referer));
      const $ = load(html);
      // Resolve one player per request to avoid a burst of upstream calls.
      const candidates = $('[data-link-id]').toArray().map(el => ({
        id: $(el).attr('data-link-id')!, name: $(el).text().trim(), language: $(el).closest('[data-type]').attr('data-type') || 'sub',
      }));
      const index = req.query.server === undefined ? 0 : Number(req.query.server);
      if (!Number.isSafeInteger(index) || index < 0 || index >= candidates.length) {
        res.status(404).json({ error: 'No matching episode server is available.' }); return;
      }
      const selected = candidates[index];
      const data = result(await request(`/ajax/server?get=${encodeURIComponent(selected.id)}`, referer));
      const url = typeof data.url === 'string' && allowedPlayer(data.url) ? data.url : null;
      res.setHeader('Cache-Control', 'no-store');
      const rawIntro = data.skip_data?.intro;
      const intro = Array.isArray(rawIntro) && rawIntro.length === 2 && rawIntro.every(Number.isFinite) && rawIntro[0] >= 0 && rawIntro[1] > rawIntro[0] ? rawIntro : null;
      res.json({ url, intro, externalUrl: referer, servers: candidates.map((s, i) => ({ id: i, name: s.name, language: s.language })),
        message: url ? '' : 'This host cannot be embedded here. Choose another server or open the episode on Anikoto.' });
    } catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Player unavailable.' }); }
  });
  return router;
}
export default createAnikotoRouter();
