import { SeasonSelect } from './AnimeRelations';
import BackChevron from './BackChevron';
import ThemedSelect from './ThemedSelect';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Anime } from '../types';
import CinemaPlayer, { SubtitleTrack } from './CinemaPlayer';
import { LoadingIndicator } from './CatalogUI';

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
  const [source, setSource] = useState<Match | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [language, setLanguage] = useState('sub');
  const [stream, setStream] = useState<Stream | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [retry, setRetry] = useState(0);
  const [autoStart, setAutoStart] = useState(false);
  const episode = initialEpisode || episodes[0]?.number || '';
  const index = episodes.findIndex(e => e.number === episode);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(''); setStream(null);
    void (async () => {
      try {
        if (!source) {
          const data = await read<{ items: Match[] }>(`/search?q=${encodeURIComponent(anime.title)}`, controller.signal);
          if (controller.signal.aborted) return;
          // Only an exact database ID match is safe to select automatically.
          const exact = data.items.find(m => String(m.malId) === anime.id);
          if (exact) setSource(exact);
          else setError("No matching catalog ID is available on Koto. Try Anikoto.");
        } else {
          const data = await read<{ episodes: Episode[] }>(`/${source.slug}/episodes`, controller.signal);
          if (controller.signal.aborted) return;
          setEpisodes(data.episodes);
        }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load Koto.'); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    })();
    return () => controller.abort();
  }, [source, anime.id, retry]);

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
    <Link className="back-link" to={`/anime/${anime.id}`}><BackChevron /> {anime.title}</Link>
    <span className="eyebrow">KOTO · AKAMARU PLAYER</span>
    <h1>{source?.title || anime.title}</h1>
    {!episodes.length && <SeasonSelect id={anime.id} title={anime.title}/>}
    {busy && <LoadingIndicator>Loading {source ? `episode ${episode || 'list'}` : 'title'}…</LoadingIndicator>}
    {error && <div role="alert"><p>{error}</p><p className="muted">You can try the separate Anikoto player for this title.</p><div className="episode-controls"><button className="button primary" onClick={onFallback}>Try Anikoto player</button><button className="button secondary" onClick={() => setRetry(n => n + 1)}>Retry Koto</button></div></div>}
    {source && episodes.length > 0 && <div className="watch-layout aligned-watch-layout">
      <div className="playback-header">
        <SeasonSelect id={anime.id} title={anime.title}/>
        <h2>Episode {episode} — {episodes[index]?.title || 'Unavailable'}</h2>
        {index < 0 && <p role="alert">That episode is unavailable. Choose an episode from the list.</p>}
        <label className="provider-server">Audio language<ThemedSelect aria-label="Audio language" value={language} onChange={e => { setStream(null); setLanguage(e.target.value); }}><option value="sub">Japanese · Sub</option><option value="dub">English · Dub</option></ThemedSelect></label>
      </div>
      <section>
        {stream && index >= 0 && <CinemaPlayer historyItem={{ animeId: anime.id, title: anime.title, cover: anime.coverImage, episode: String(episode), source: "koto" }} key={`${source.slug}-${episode}-${language}-${retry}`} direct autoStart={autoStart} url={stream.url} tracks={stream.tracks} intro={stream.intro} outro={stream.outro} title={`${source.title} · Episode ${episode}`} onPlaybackError={setError} onNext={index < episodes.length - 1 ? () => selectEpisode(episodes[index + 1].number) : undefined} />}
        <p className="muted">Koto sources via Anikage · Played with Akamaru controls. Availability varies by episode and language.</p>
        <div className="episode-controls"><button className="button secondary" disabled={index <= 0} onClick={() => selectEpisode(episodes[index - 1].number)}><BackChevron /> Previous</button><button className="button primary" disabled={index < 0 || index >= episodes.length - 1} onClick={() => selectEpisode(episodes[index + 1].number)}>Next <BackChevron forward /></button></div>
      </section>
      <aside><h2>Episodes ({episodes.length})</h2><div className="provider-episodes" tabIndex={0} role="region" aria-label="Scrollable episode list">{episodes.map(e => <button key={e.number} className={`episode-row ${e.number === episode ? 'selected' : ''}`} aria-current={e.number === episode ? 'true' : undefined} onClick={() => selectEpisode(e.number)}><span className="episode-number">{e.number}</span><strong>{e.title}</strong></button>)}</div></aside>
    </div>}
    {source && !busy && !error && episodes.length === 0 && <p>No episodes are listed for this title.</p>}
  </div>;
}
