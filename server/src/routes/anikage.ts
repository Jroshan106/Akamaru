import { Router } from 'express';
import { Readable } from 'stream';

const ANIKAGE_REFERER = 'https://anikage.cc/';
const ANIKAGE_HOST = 'https://og.bakayaro.live';

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

  // Media playlist proxy: injects required Anikage Referer header so upstream serves the m3u8
  router.get('/media/m3u8/:token', async (req, res) => {
    const token = req.params.token;
    if (!/^[\w-]+$/.test(token)) {
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
      });
      if (!response.ok) {
        res.status(response.status).send('Upstream playlist unavailable');
        return;
      }
      let text = await response.text();
      // Rewrite upstream media URLs to pass through our proxy
      text = text.split(`${ANIKAGE_HOST}/m3u8/`).join('/api/anikage/media/m3u8/');
      text = text.split(`${ANIKAGE_HOST}/stream/`).join('/api/anikage/media/stream/');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(text);
    } catch {
      if (!res.headersSent) res.status(502).send('Error fetching playlist');
    }
  });

  // Media chunk stream proxy: injects required Anikage Referer header so upstream serves video segments
  router.get('/media/stream/:token', async (req, res) => {
    const token = req.params.token;
    if (!/^[\w-]+$/.test(token)) {
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
      const response = await fetcher(`${ANIKAGE_HOST}/stream/${token}`, {
        headers,
        signal: AbortSignal.timeout(15000),
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
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

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
    if (!/^[\w-]+$/.test(token)) {
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
      });
      if (!response.ok) {
        res.status(response.status).send('Subtitle track unavailable');
        return;
      }
      const text = await response.text();
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
