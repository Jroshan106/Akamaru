import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Anime } from '../types';
import CinemaPlayer, { SubtitleTrack } from './CinemaPlayer';

type Match = { slug: string; malId: number | null; title: string; year: number | null };
type Episode = { number: string; title: string };
type Stream = { url: string; tracks: SubtitleTrack[]; intro: [number, number] | null; outro: [number, number] | null };
async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/anikage${path}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Koto is temporarily unavailable.');
  return data;
}

export default function KotoEpisodes({ anime, initialEpisode, onFallback }: { anime: Anime; initialEpisode?: string; onFallback: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(anime.title);
  const [search, setSearch] = useState(anime.title);
  const [matches, setMatches] = useState<Match[]>([]);
  const [source, setSource] = useState<Match | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [language, setLanguage] = useState('sub');
  const [stream, setStream] = useState<Stream | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [retry, setRetry] = useState(0);
  const [changeSource, setChangeSource] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const episode = initialEpisode || episodes[0]?.number || '';
  const index = episodes.findIndex(e => e.number === episode);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(''); setStream(null);
    void (async () => {
      try {
        if (!source) {
          const data = await read<{ items: Match[] }>(`/search?q=${encodeURIComponent(search)}`, controller.signal);
          if (controller.signal.aborted) return;
          setMatches(data.items);
          // Only an exact database ID match is safe to select automatically.
          const exact = data.items.find(m => String(m.malId) === anime.id);
          if (exact) setSource(exact);
        } else {
          const data = await read<{ episodes: Episode[] }>(`/${source.slug}/episodes`, controller.signal);
          if (controller.signal.aborted) return;
          setEpisodes(data.episodes);
        }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load Koto.'); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    })();
    return () => controller.abort();
  }, [source, search, anime.id, retry]);

  useEffect(() => {
    if (!source || !episode || index < 0) return;
    const controller = new AbortController();
    setStream(null); setBusy(true); setError('');
    void read<Stream>(`/${source.slug}/${episode}?lang=${language}`, controller.signal)
      .then(data => { if (!controller.signal.aborted) setStream(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [source, episode, index, language, retry]);

  function selectEpisode(number: string) {
    setStream(null);
    setAutoStart(true);
    navigate(`/anime/${anime.id}/episodes/${number}`);
  }
  return <div className="page watch-page provider-page">
    <Link className="back-link" to={`/anime/${anime.id}`}>← {anime.title}</Link>
    <span className="eyebrow">KOTO · AKAMARU PLAYER</span>
    <h1>{source?.title || anime.title}</h1>
    <button className="text-link" onClick={() => setChangeSource(v => !v)}>Change title / season</button>
    {(!source || changeSource) && <>
      <form className="provider-search" onSubmit={e => { e.preventDefault(); setSource(null); setEpisodes([]); setStream(null); setSearch(query.trim()); setRetry(n => n + 1); }}>
        <input aria-label="Search Koto titles" value={query} onChange={e => setQuery(e.target.value)} maxLength={180} required />
        <button className="button primary">Search</button>
      </form>
      {!busy && !error && !matches.length && <p>No matching titles. Try another title spelling.</p>}
      {!source && matches.length > 0 && <p>Select the correct title and season. An exact catalog ID match was not found.</p>}
      <div className="episode-list">{matches.map(m => <button className="episode-row" key={m.slug} onClick={() => { setEpisodes([]); setStream(null); setSource(m); setChangeSource(false); navigate(`/anime/${anime.id}/episodes`, { replace: true }); }}><strong>{m.title}</strong><span>{m.year} · Select →</span></button>)}</div>
    </>}
    {busy && <p role="status">Loading {source ? `episode ${episode || 'list'}` : 'title'}…</p>}
    {error && <div role="alert"><p>{error}</p><p className="muted">You can try the separate Anikoto player for this title.</p><div className="episode-controls"><button className="button primary" onClick={onFallback}>Try Anikoto player</button><button className="button secondary" onClick={() => setRetry(n => n + 1)}>Retry Koto</button></div></div>}
    {source && episodes.length > 0 && <div className="watch-layout">
      <section>
        <h2>Episode {episode} — {episodes[index]?.title || 'Unavailable'}</h2>
        {index < 0 && <p role="alert">That episode is unavailable. Choose an episode from the list.</p>}
        <label className="provider-server">Audio language<select value={language} onChange={e => { setStream(null); setLanguage(e.target.value); }}><option value="sub">Japanese · Sub</option><option value="dub">English · Dub</option></select></label>
        {stream && index >= 0 && <CinemaPlayer key={`${source.slug}-${episode}-${language}-${retry}`} direct autoStart={autoStart} url={stream.url} tracks={stream.tracks} intro={stream.intro} outro={stream.outro} title={`${source.title} · Episode ${episode}`} onNext={index < episodes.length - 1 ? () => selectEpisode(episodes[index + 1].number) : undefined} />}
        <p className="muted">Koto sources via Anikage · Played with Akamaru controls. Availability varies by episode and language.</p>
        <div className="episode-controls"><button className="button secondary" disabled={index <= 0} onClick={() => selectEpisode(episodes[index - 1].number)}>← Previous</button><button className="button primary" disabled={index < 0 || index >= episodes.length - 1} onClick={() => selectEpisode(episodes[index + 1].number)}>Next →</button></div>
      </section>
      <aside><h2>Episodes ({episodes.length})</h2><div className="provider-episodes">{episodes.map(e => <button key={e.number} className={`episode-row ${e.number === episode ? 'selected' : ''}`} aria-current={e.number === episode ? 'true' : undefined} onClick={() => selectEpisode(e.number)}><span className="episode-number">{e.number}</span><strong>{e.title}</strong></button>)}</div></aside>
    </div>}
    {source && !busy && !error && episodes.length === 0 && <p>No episodes are listed for this title.</p>}
  </div>;
}
