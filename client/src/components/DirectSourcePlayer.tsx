import ThemedSelect from './ThemedSelect';
import { useEffect, useState } from 'react';
import CinemaPlayer, { SubtitleTrack } from './CinemaPlayer';

type Stream = { url: string; intro: [number, number] | null; outro?: [number, number] | null; tracks: SubtitleTrack[] };

function parseAnikageSlug(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_-]{6,80}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/^\/anime\/(?:watch|info)\/([A-Za-z0-9_-]{1,80})\/?$/);
    if (match) return match[1];
  } catch { /* Not a full URL */ }
  return null;
}

export default function DirectSourcePlayer({ animeId, episode, title, onNext }: { animeId: string; episode: string; title: string; onNext?: () => void }) {
  const key = `akamaru-anikage-${animeId}`;
  const [link, setLink] = useState(() => { try { return localStorage.getItem(key) || ''; } catch { return ''; } });
  const [sourceId, setSourceId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(key) || '';
      return parseAnikageSlug(stored) || '';
    } catch { return ''; }
  });
  const [lang, setLang] = useState('sub');
  const [stream, setStream] = useState<Stream | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!sourceId) return;
    const controller = new AbortController();
    setBusy(true); setStream(null); setError('');
    void fetch(`/api/anikage/${sourceId}/${episode}?lang=${lang}`, { signal: controller.signal }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Source unavailable.');
      if (!controller.signal.aborted) setStream(data);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [sourceId, episode, lang, retry]);

  function loadLink(valueToLoad?: string) {
    const target = valueToLoad ?? link;
    const slug = parseAnikageSlug(target);
    if (!slug) {
      setError('Enter an Anikage watch/info link (e.g. https://anikage.cc/anime/watch/Z78KNV8HKq) or slug ID.');
      return;
    }
    setSourceId(slug);
    setRetry(n => n + 1);
    setError('');
    try { localStorage.setItem(key, target); } catch { /* Storage is optional. */ }
  }

  return <div>
    <form className="provider-search" onSubmit={e => { e.preventDefault(); loadLink(); }}>
      <input aria-label="Anikage title link" type="text" value={link} onChange={e => setLink(e.target.value)} placeholder="Paste https://anikage.cc/anime/watch/Z78KNV8HKq or ID…" required />
      <button className="button primary" type="submit">Load Koto source</button>
    </form>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', margin: '8px 0 16px' }}>
      <p className="muted" style={{ margin: 0 }}>
        {sourceId ? `Playing Anikage Koto source (${sourceId}) · Episode ${episode}` : 'Paste an Anikage link to unlock 1080p quality, captions, speed and auto-skip.'}
      </p>
      <label className="provider-server" style={{ margin: 0 }}>
        Audio:
        <ThemedSelect aria-label="Audio language" value={lang} onChange={e => setLang(e.target.value)}>
          <option value="sub">Sub (Japanese)</option>
          <option value="dub">Dub (English)</option>
        </ThemedSelect>
      </label>
    </div>
    {busy && <p role="status">Loading direct video source…</p>}
    {error && <p role="alert" style={{ color: '#ff6b8b' }}>{error}</p>}
    {stream && (
      <CinemaPlayer
        key={`${sourceId}-${episode}-${lang}-${retry}`}
        url={stream.url}
        direct
        tracks={stream.tracks}
        intro={stream.intro}
        outro={stream.outro}
        title={title}
        onNext={onNext}
      />
    )}
  </div>;
}


