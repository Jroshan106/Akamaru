import { Router } from 'express';
import { Readable } from 'stream';

const ANIKAGE_REFERER = 'https://anikage.cc/';
const ANIKAGE_HOST = 'https://og.bakayaro.live';
const tokenPattern = /^[\w-]{1,8000}$/;
const idPattern = /^[A-Za-z0-9_-]{1,80}$/;

export function rewritePlaylist(text: string, upstream: string): string {
  if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('Invalid playlist');
  const rewrite = (value: string) => {
    const url = new URL(value, upstream);
    const match = url.pathname.match(/^\/(m3u8|stream|hls)\/([\w-]{1,8000})$/);
    if (url.origin !== ANIKAGE_HOST || url.username || url.password || url.search || !match) throw new Error('Unsupported media resource');
    return `/api/anikage/media/${match[1]}/${match[2]}`;
  };
  return text.split(/\r?\n/).map(line => {
    const value = line.trim();
    if (!value) return line;
    if (value.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${rewrite(uri)}"`);
    return rewrite(value);
  }).join('\n');
}

// Optional integration with Anikage's public source service.
// Never forward a client-supplied URL or expose a general-purpose proxy.
export function mediaUrl(value: unknown, hls = false): string | null {
  if (typeof value !== 'string' || !value || value.length > 8000) return null;
  if (/^[\w-]+$/.test(value)) return `${ANIKAGE_HOST}/${hls ? 'm3u8' : 'stream'}/${value}`;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'og.bakayaro.live' && !u.username && !u.password && !u.port ? u.href : null;
  } catch { return null; }
}

export function createAnikageRouter(fetcher: typeof fetch = fetch) {
  const router = Router();
  const metadata = new Map<string, { until: number; data: unknown }>();
  const pending = new Map<string, Promise<any>>();
  async function catalog(path: string) {
    const cached = metadata.get(path);
    if (cached && cached.until > Date.now()) return cached.data;
    if (pending.has(path)) return pending.get(path);
    if (pending.size >= 6) throw new Error('Source service is busy. Please retry shortly.');
    const work = (async () => {
      const response = await fetcher(`https://anikage.cc/api/media/anime${path}`, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Koto catalog is unavailable. Please try again.');
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error('Unexpected catalog response.');
      const data = JSON.parse(text);
      if (metadata.size >= 100) metadata.delete(metadata.keys().next().value!);
      metadata.set(path, { until: Date.now() + 60000, data });
      return data;
    })();
    pending.set(path, work);
    try { return await work; } finally { pending.delete(path); }
  }
  router.get('/search', async (req, res) => {
    const q = req.query.q;
    if (typeof q !== 'string' || !q.trim() || q.length > 180) { res.status(400).json({ error: 'Enter an anime title.' }); return; }
    try {
      const data = await catalog(`/browse?q=${encodeURIComponent(q.trim())}&page=1&limit=25`);
      const items = (Array.isArray(data.data) ? data.data : []).filter((a: any) => a && idPattern.test(a.slug) && a.title)
        .map((a: any) => ({ slug: a.slug, malId: Number.isSafeInteger(a.malId) ? a.malId : null, title: a.title.english || a.title.romaji || a.title.native, year: a.year || null }));
      res.json({ items });
    } catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Search unavailable.' }); }
  });
  router.get('/:id/episodes', async (req, res) => {
    if (!idPattern.test(req.params.id)) { res.status(400).json({ error: 'Invalid title.' }); return; }
    try {
      const data = await catalog(`/${req.params.id}/episodes`);
      if (!Array.isArray(data)) throw new Error('Unexpected episode response.');
      const episodes = data.filter((e: any) => e && Number.isFinite(e.number) && e.number > 0)
        .map((e: any) => ({ number: String(e.number), title: String(e.title || `Episode ${e.number}`) }))
        .sort((a, b) => Number(a.number) - Number(b.number));
      res.json({ episodes });
    } catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Episodes unavailable.' }); }
  });

  // Media playlist proxy: injects required Anikage Referer header so upstream serves the m3u8
  router.get('/media/m3u8/:token', async (req, res) => {
    const token = req.params.token;
    if (!tokenPattern.test(token)) {
      res.status(400).send('Invalid token');
      return;
    }
    try {
      const response = await fetcher(`${ANIKAGE_HOST}/m3u8/${token}`, {
        headers: {
          Referer: ANIKAGE_REFERER,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      if (!response.ok) {
        res.status(response.status).send('Upstream playlist unavailable');
        return;
      }
      let text = await response.text();
      if (text.length > 2_000_000) throw new Error('Playlist too large');
      text = rewritePlaylist(text, `${ANIKAGE_HOST}/m3u8/${token}`);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'private, max-age=30');
      res.send(text);
    } catch {
      if (!res.headersSent) res.status(502).send('Error fetching playlist');
    }
  });

  // Media chunk stream proxy: injects required Anikage Referer header so upstream serves video segments
  router.get('/media/:kind(stream|hls)/:token', async (req, res) => {
    const token = req.params.token;
    if (!tokenPattern.test(token) || (req.headers.range && !/^bytes=\d*-\d*$/.test(req.headers.range))) {
      res.status(400).send('Invalid token');
      return;
    }
    try {
      const headers: Record<string, string> = {
        Referer: ANIKAGE_REFERER,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };
      if (req.headers.range) {
        headers.Range = req.headers.range;
      }
      const controller = new AbortController();
      res.on('close', () => controller.abort());
      const response = await fetcher(`${ANIKAGE_HOST}/${req.params.kind}/${token}`, {
        headers,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        redirect: 'error',
      });
      if (!response.ok && response.status !== 206) {
        res.status(response.status).send('Upstream stream unavailable');
        return;
      }
      res.status(response.status);
      res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp2t');
      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const contentRange = response.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      res.setHeader('Cache-Control', 'private, max-age=60');

      if (response.body) {
        const stream = Readable.fromWeb(response.body as any);
        stream.on('error', () => {
          if (!res.headersSent) res.status(502).end();
          else res.destroy();
        });
        stream.pipe(res);
      } else {
        res.end();
      }
    } catch {
      if (!res.headersSent) res.status(502).send('Error fetching stream segment');
    }
  });

  // Subtitles proxy: sets text/vtt MIME type and bypasses Referer restriction
  router.get('/media/subtitles/:token', async (req, res) => {
    const token = req.params.token;
    if (!tokenPattern.test(token)) {
      res.status(400).send('Invalid token');
      return;
    }
    try {
      const response = await fetcher(`${ANIKAGE_HOST}/stream/${token}`, {
        headers: {
          Referer: ANIKAGE_REFERER,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      if (!response.ok) {
        res.status(response.status).send('Subtitle track unavailable');
        return;
      }
      const text = await response.text();
      if (text.length > 2_000_000 || !text.replace(/^\uFEFF/, '').trimStart().startsWith('WEBVTT')) throw new Error('Invalid subtitles');
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(text);
    } catch {
      if (!res.headersSent) res.status(502).send('Error fetching subtitles');
    }
  });

  router.get('/:id/:episode', async (req, res) => {
    const { id, episode } = req.params;
    const lang = req.query.lang || 'sub';
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !/^\d{1,5}(?:\.\d{1,2})?$/.test(episode) || !['sub', 'dub'].includes(String(lang))) {
      res.status(400).json({ error: 'Invalid title, episode or language.' }); return;
    }
    try {
      const response = await fetcher(`https://anikage.cc/api/media/anime/${id}/episodes/${episode}/sources?provider=koto&lang=${lang}&server=koto`, {
        signal: AbortSignal.timeout(12000), redirect: 'error', headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Source service unavailable. Try the existing player.');
      const body = await response.text();
      if (body.length > 500000) throw new Error('Unexpected source response.');
      const data = JSON.parse(body);
      const source = Array.isArray(data.sources) ? data.sources.find((s: any) => s?.isM3U8 && mediaUrl(s.url, true)) : null;
      if (!source) throw new Error('No compatible direct stream is available for this episode.');
      const tracks = (Array.isArray(data.subtitles) ? data.subtitles : []).filter((t: any) => t && ['captions', 'subtitles'].includes(t.kind) && mediaUrl(t.file))
        .slice(0, 40).map((t: any) => ({ url: mediaUrl(t.file), label: String(t.label || 'Subtitles').slice(0, 80), default: t.default === true }));
      const intro = Number.isFinite(data.intro?.start) && Number.isFinite(data.intro?.end) && data.intro.start >= 0 && data.intro.end > data.intro.start ? [data.intro.start, data.intro.end] : null;
      const outro = Number.isFinite(data.outro?.start) && Number.isFinite(data.outro?.end) && data.outro.start >= 0 && data.outro.end > data.outro.start ? [data.outro.start, data.outro.end] : null;
      res.setHeader('Cache-Control', 'no-store');
      res.json({ url: mediaUrl(source.url, true), tracks, intro, outro });
    } catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Unable to load source.' }); }
  });
  return router;
}
export default createAnikageRouter();
