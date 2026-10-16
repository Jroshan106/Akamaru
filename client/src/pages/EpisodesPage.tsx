import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../lib/catalog';
import { CatalogState, NotFound } from '../components/CatalogUI';
import CinemaPlayer from '../components/CinemaPlayer';

type Match = { slug: string; title: string };
type Episode = { number: string; title: string; sub: boolean; dub: boolean };
type Player = { url: string | null; externalUrl: string; message: string; servers: { id: number; name: string; language: string }[] };
async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/anikoto${path}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Anikoto is unavailable. Please try again.');
  return data;
}
export default function EpisodesPage() {
  const { id } = useParams();
  const { anime, loading, error } = useCatalog();
  const item = anime.find(a => a.id === id);
  if (loading || error) return <CatalogState />;
  if (!item) return <NotFound />;
  return <EpisodeBrowser key={item.id} id={item.id} title={item.title} />;
}
function EpisodeBrowser({ id, title }: { id: string; title: string }) {
  const [query, setQuery] = useState(title);
  const [search, setSearch] = useState(title);
  const [matches, setMatches] = useState<Match[]>([]);
  const [source, setSource] = useState<Match | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episode, setEpisode] = useState('');
  const [server, setServer] = useState(0);
  const [player, setPlayer] = useState<Player | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(''); setPlayer(null);
    async function load() {
      try {
        if (!source) {
          const data = await get<{ items: Match[] }>(`/search?q=${encodeURIComponent(search)}`, controller.signal);
          if (!controller.signal.aborted) setMatches(data.items);
        } else if (!episode) {
          const data = await get<{ episodes: Episode[] }>(`/${source.slug}/episodes`, controller.signal);
          if (!controller.signal.aborted) setEpisodes(data.episodes);
        } else {
          const data = await get<Player>(`/${source.slug}/episodes/${episode}/players?server=${server}`, controller.signal);
          if (!controller.signal.aborted) setPlayer(data);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load Anikoto.');
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }
    load();
    return () => controller.abort();
  }, [source, episode, server, search, retry]);
  const index = episodes.findIndex(e => e.number === episode);
  function selectEpisode(number: string) { setPlayer(null); setEpisode(number); setServer(0); }
  return <div className="page watch-page provider-page">
    <Link className="back-link" to={`/anime/${id}`}>← {title}</Link>
    <span className="eyebrow">EPISODES · ANIKOTO</span>
    <h1>{source?.title || title}</h1>
    {busy && <p role="status">Loading {episode ? 'player' : source ? 'episodes' : 'matches'}…</p>}
    {error && <div role="alert"><p>{error}</p><button className="button secondary" onClick={() => setRetry(n => n + 1)}>Try again</button></div>}
    {!source ? <>
      <p className="muted">Choose the matching title and season on Anikoto.</p>
      <form className="provider-search" onSubmit={e => { e.preventDefault(); setSearch(query.trim()); setRetry(n => n + 1); }}>
        <input aria-label="Search Anikoto" value={query} onChange={e => setQuery(e.target.value)} maxLength={180} required />
        <button className="button primary">Search</button>
      </form>
      {!busy && !error && matches.length === 0 && <p>No matching titles. Try the Japanese title or a shorter name.</p>}
      <div className="episode-list">{matches.map(match => <button className="episode-row" key={match.slug} onClick={() => { setEpisodes([]); setSource(match); }}><strong>{match.title}</strong><span>Choose →</span></button>)}</div>
    </> : <>
      <button className="text-link" onClick={() => { setSource(null); setEpisode(''); setEpisodes([]); }}>Change title / season</button>
      <div className="watch-layout">
        <section>
          {episode && <h2>Episode {episode} — {episodes[index]?.title}</h2>}
          {player && <>
            <label className="provider-server">Server and language
              <select value={server} onChange={e => setServer(Number(e.target.value))}>{player.servers.map(s => <option key={s.id} value={s.id}>{s.name} · {s.language.toUpperCase()}</option>)}</select>
            </label>
            {player.url ? <CinemaPlayer key={player.url} url={player.url} title={`${source.title} · Episode ${episode}`} onNext={index >= 0 && index < episodes.length - 1 ? () => selectEpisode(episodes[index + 1].number) : undefined} /> : <div className="cinema-unavailable"><p>{player.message}</p></div>}
            <p className="muted">Player hosted by Anikoto’s video provider. Availability may vary.</p>
            <a className="text-link" href={player.externalUrl} target="_blank" rel="noreferrer">Player not working? Open episode on Anikoto ↗</a>
          </>}
          {!episode && !busy && !error && <p className="muted">{episodes.length ? 'Choose an episode to start watching.' : 'No episodes are available for this title yet.'}</p>}
          {episode && <div className="episode-controls">
            <button className="button secondary" disabled={index <= 0} onClick={() => selectEpisode(episodes[index - 1].number)}>← Previous</button>
            <button className="button primary" disabled={index < 0 || index >= episodes.length - 1} onClick={() => selectEpisode(episodes[index + 1].number)}>Next →</button>
          </div>}
        </section>
        <aside><h2>Episodes ({episodes.length})</h2><div className="provider-episodes">{episodes.map(e => <button key={e.number} className={`episode-row ${e.number === episode ? 'selected' : ''}`} aria-current={e.number === episode ? 'true' : undefined} onClick={() => selectEpisode(e.number)}>
          <span className="episode-number">{e.number}</span><div><strong>{e.title || `Episode ${e.number}`}</strong><span>{[e.sub && 'Sub', e.dub && 'Dub'].filter(Boolean).join(' · ')}</span></div>
        </button>)}</div></aside>
      </div>
    </>}
  </div>;
}
