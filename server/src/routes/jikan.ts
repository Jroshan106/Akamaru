import { Router } from 'express';

// Only the catalog endpoints used by the app may be forwarded.
// The upstream host is fixed; this is not an arbitrary URL proxy.
export function createJikanRouter(fetcher: typeof fetch = fetch, spacingMs = 1050, timeoutMs = 8000) {
  const router = Router();
  const cache = new Map<string, { body: unknown; expires: number }>();
  const pending = new Map<string, Promise<{ status: number; body: unknown }>>();
  let nextStart = 0;
  const allowedQuery = new Set(['q', 'page', 'limit', 'genres', 'status', 'order_by', 'sort', 'sfw']);
  router.get('*', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const seasonal = /^\/seasons\/[12]\d{3}\/(winter|spring|summer|fall)$/.test(req.path);
    if (!seasonal && !/^\/(seasons|top\/anime|genres\/anime|anime(?:\/[1-9]\d*(?:\/relations)?)?)$/.test(req.path)) {
      res.status(404).json({ error: 'Catalog endpoint not found' }); return;
    }
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      // Vercel rewrites can add route captures (e.g. `path`) to req.query.
      // Ignore non-catalog parameters; never forward them to the fixed host.
      if (!allowedQuery.has(key)) continue;
      if (typeof value !== 'string' || value.length > 200) {
        res.status(400).json({ error: 'Invalid catalog query' }); return;
      }
      query.set(key, value);
    }
    if (seasonal || req.path === '/anime' || req.path === '/top/anime') {
      query.set('sfw', 'true');
      const limit = Number(query.get('limit') || 24);
      const page = Number(query.get('page') || 1);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25 || !Number.isSafeInteger(page) || page < 1) {
        res.status(400).json({ error: 'Invalid catalog page or limit' }); return;
      }
      query.set('limit', String(limit));
      query.set('page', String(page));
    }
    query.sort();
    const key = `${req.path}?${query}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
      res.json(cached.body); return;
    }
    let request = pending.get(key);
    if (!request) {
      if (pending.size >= 8) { res.status(503).json({ error: 'Catalog is busy. Please try again shortly.' }); return; }
      const wait = Math.max(0, nextStart - Date.now());
      nextStart = Date.now() + wait + spacingMs;
      request = (async () => {
        await new Promise(resolve => setTimeout(resolve, wait));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetcher(`https://api.tenrai.org/v1${key}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
          if (!response.ok) {
            const status = [400, 404, 429].includes(response.status) ? response.status : 502;
            return { status, body: { error: status === 429 ? 'The anime provider is busy. Please wait a minute, then try again.' : 'The anime provider could not load this catalog request. Please try again.' } };
          }
          const body = await response.json();
          if (!body || typeof body !== 'object' || !('data' in body)) throw new Error('Invalid upstream response');
          if (cache.size >= 100) cache.delete(cache.keys().next().value!);
          cache.set(key, { body, expires: Date.now() + 300000 });
          return { status: 200, body };
        } catch {
          return { status: 502, body: { error: 'The server cannot reach the anime provider right now. Please try again shortly.' } };
        } finally { clearTimeout(timer); }
      })();
      pending.set(key, request);
      void request.finally(() => pending.delete(key));
    }
    const result = await request;
    if (result.status === 200) res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    if (result.status === 429) res.setHeader('Retry-After', '60');
    res.status(result.status).json(result.body);
  });
  return router;
}

export default createJikanRouter();
