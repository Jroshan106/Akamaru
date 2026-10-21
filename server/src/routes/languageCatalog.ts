import { Router } from 'express';
import { load } from 'cheerio';
import { normalizeTitle, parseSearch } from './anikoto';

// Audio availability comes from the provider's Sub/Dub catalog, not MAL metadata.
export function createLanguageCatalogRouter(fetcher: typeof fetch = fetch, spacingMs = 1050) {
  const router = Router();
  const cache = new Map<string, { until: number; body: unknown }>();
  const titles = new Map<string, { until: number; item: Record<string, unknown> | null }>();
  const pending = new Map<string, Promise<unknown>>();
  let nextCatalogStart = 0;
  async function request(url: string) {
    if (url.startsWith('https://api.tenrai.org/')) {
      const wait = Math.max(0, nextCatalogStart - Date.now());
      nextCatalogStart = Date.now() + wait + spacingMs;
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    }
    const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    if (response.status === 429) throw new Error('The language catalog is busy. Please wait a minute and try again.');
    if (!response.ok) throw new Error('Language listings are temporarily unavailable. Please try again.');
    return response;
  }
  router.get('/', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const { language, genre = '', search = '', sort = 'rating', page = '1' } = req.query;
    if (!['sub', 'dub'].includes(String(language)) || typeof language !== 'string' ||
      typeof genre !== 'string' || genre.length > 80 || typeof search !== 'string' || search.length > 180 ||
      typeof sort !== 'string' || !['rating', 'year', 'title'].includes(sort) ||
      typeof page !== 'string' || !/^[1-9]\d{0,3}$/.test(page)) {
      res.status(400).json({ error: 'Choose a valid language and catalog filters.' }); return;
    }
    const query = new URLSearchParams({ 'language[]': language, keyword: search, page,
      sort: sort === 'title' ? 'name-az' : sort === 'year' ? 'release-date' : 'score',
      direction: sort === 'title' ? 'asc' : 'desc' });
    const key = `${query}&genre=${encodeURIComponent(genre)}`;
    const cached = cache.get(key);
    if (cached && cached.until > Date.now()) { res.json(cached.body); return; }
    try {
      let work = pending.get(key);
      if (!work) {
        if (pending.size >= 4) { res.status(503).json({ error: 'Language catalog is busy. Please retry shortly.' }); return; }
        work = (async () => {
          let html = await (await request(`https://anikototv.to/filter?${query}`)).text();
          if (html.length > 2_000_000) throw new Error('Unexpected language catalog response.');
          if (genre) {
            const $ = load(html);
            const field = $('input[name="genre[]"]').toArray().find(el => $(el).parent().text().trim().toLowerCase() === genre.toLowerCase());
            if (!field) return { data: [], pagination: { has_next_page: false } };
            query.set('genre[]', $(field).attr('value') || '');
            html = await (await request(`https://anikototv.to/filter?${query}`)).text();
          }
          const $ = load(html);
          if (!$('input[name="language[]"]').length) throw new Error('Language listings could not be read. Please retry.');
          const entries = parseSearch(html);
          if (entries.length > 40) throw new Error('The provider returned too many titles. Please retry.');
          const data: Record<string, unknown>[] = [];
          // Resolve exact catalog aliases so cards always link to the correct MAL ID.
          for (let offset = 0; offset < entries.length; offset += 3) {
            const batch = await Promise.all(entries.slice(offset, offset + 3).map(async entry => {
              const key = `${entry.title}|${entry.alternateTitle}`;
              const known = titles.get(key);
              if (known && known.until > Date.now()) return known.item;
              const response = await request(`https://api.tenrai.org/v1/anime?q=${encodeURIComponent(entry.alternateTitle || entry.title)}&limit=10&sfw=true`);
              const result = await response.json() as { data?: Record<string, unknown>[] };
              if (!Array.isArray(result.data)) throw new Error('The catalog returned an unexpected response.');
              const aliases = [entry.title, entry.alternateTitle].filter(Boolean).map(normalizeTitle);
              const matches = result.data.filter(item => [item.title, item.title_english, item.title_japanese]
                .some(name => typeof name === 'string' && aliases.includes(normalizeTitle(name))));
              const item = matches.length === 1 && Number.isSafeInteger(matches[0].mal_id) ? matches[0] : null;
              if (titles.size >= 500) titles.delete(titles.keys().next().value!);
              titles.set(key, { until: Date.now() + 300000, item });
              return item;
            }));
            data.push(...batch.filter((item): item is Record<string, unknown> => item !== null));
          }
          return { data: [...new Map(data.map(item => [item.mal_id, item])).values()],
            pagination: { current_page: Number(page), has_next_page: $('.pagination a[rel="next"]').length > 0 } };
        })();
        pending.set(key, work);
        void work.finally(() => pending.delete(key)).catch(() => {});
      }
      const body = await work;
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { until: Date.now() + 300000, body });
      res.json(body);
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : 'Language catalog could not load.' });
    }
  });
  return router;
}
export default createLanguageCatalogRouter();
