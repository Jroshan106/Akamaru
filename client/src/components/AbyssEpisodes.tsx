import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Anime } from '../types';
import BackChevron from './BackChevron';
import { LoadingIndicator } from './CatalogUI';
import ProviderPlayer from './ProviderPlayer';
import ThemedSelect from './ThemedSelect';

type Mapping = { malId: number; anilistId: number; episodes: { number: string; title: string }[] };
export default function AbyssEpisodes({ anime, initialEpisode }: { anime: Anime; initialEpisode?: string }) {
  const navigate = useNavigate();
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [playerAttempt, setPlayerAttempt] = useState(0);
  const [players, setPlayers] = useState<{language: string; url: string}[]>([]);
  const [playerBusy, setPlayerBusy] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [language, setLanguage] = useState(() => { try { return localStorage.getItem('akamaru-abyss-language') || 'English'; } catch { return 'English'; } });
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(''); setMapping(null);
    void fetch(`/api/nexus/${anime.id}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not find episode metadata for this anime.');
      if (!controller.signal.aborted) setMapping(data);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [anime.id, attempt]);
  const episode = initialEpisode || mapping?.episodes[0]?.number;
  const index = mapping?.episodes.findIndex(e => e.number === episode) ?? -1;
  const anilistId = mapping?.anilistId;
  useEffect(() => {
    setPlayers([]); setPlayerError('');
    if (!anilistId || !episode || index < 0) { setPlayerBusy(false); return; }
    const controller = new AbortController();
    setPlayerBusy(true);
    void fetch(`/api/animelok/${anilistId}/${episode}${playerAttempt ? '?refresh=1' : ''}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load this episode.');
      if (!controller.signal.aborted) setPlayers(data.players);
    }).catch(e => { if (!controller.signal.aborted) setPlayerError(e.message); }).finally(() => { if (!controller.signal.aborted) setPlayerBusy(false); });
    return () => controller.abort();
  }, [anilistId, episode, index, playerAttempt]);
  const selected = players.find(p => p.language.toLowerCase() === language.toLowerCase()) || players.find(p => p.language === 'English') || players.find(p => p.language === 'Japanese') || players[0];
  const url = selected?.url || '';
  const selectEpisode = (number: string) => navigate(`/anime/${anime.id}/episodes/${number}`);
  return <div className="page watch-page provider-page abyss-page">
    <Link className="back-link" to={`/anime/${anime.id}`}><BackChevron/> {anime.title}</Link>
    <span className="eyebrow">ABYSS PLAYER</span><h1>{anime.title}</h1>
    {busy && <LoadingIndicator>Finding anime and episodes...</LoadingIndicator>}
    {error && <div role="alert"><p>{error}</p><button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Retry anime mapping</button></div>}
    {mapping && <div className="watch-layout aligned-watch-layout">
      <div className="playback-header"><h2>Episode {episode || '—'}{index >= 0 ? ` — ${mapping.episodes[index].title}` : ''}</h2>
        {players.length > 0 && <label className="provider-server">Audio language<ThemedSelect aria-label="Audio language" value={selected?.language || ''} onChange={e => { setLanguage(e.target.value); try { localStorage.setItem('akamaru-abyss-language', e.target.value); } catch {} }}>{players.map(p => <option key={p.language} value={p.language}>{p.language}</option>)}</ThemedSelect></label>}
      </div>
      <section>
        {playerBusy && <LoadingIndicator>Loading episode player...</LoadingIndicator>}
        {playerError && <p role="alert">{playerError}</p>}
        {url && <ProviderPlayer key={`${url}-${playerAttempt}`} url={url} title={`${anime.title} · Episode ${episode} · ${selected.language}`} referrerPolicy="origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"/>}
        {index < 0 && <p role="alert">{mapping.episodes.length ? 'This episode is not listed. Choose an episode below.' : 'No aired episodes are listed for this anime yet.'}</p>}
        <p className="muted">Use the controls inside the Abyss player. Available languages vary by episode.</p>
        {index >= 0 && <div className="episode-controls"><button className="button secondary" disabled={playerBusy} onClick={() => setPlayerAttempt(n => n + 1)}>{playerError ? 'Retry player' : 'Reload player'}</button></div>}
        <div className="episode-controls"><button className="button secondary" disabled={index <= 0} onClick={() => selectEpisode(mapping.episodes[index - 1].number)}><BackChevron/> Previous</button><button className="button primary" disabled={index < 0 || index >= mapping.episodes.length - 1} onClick={() => selectEpisode(mapping.episodes[index + 1].number)}>Next <BackChevron forward/></button></div>
      </section>
      <aside><h2>Episodes ({mapping.episodes.length})</h2><div className="provider-episodes" tabIndex={0} role="region" aria-label="Scrollable episode list">{mapping.episodes.map(e => <button key={e.number} className={`episode-row ${e.number === episode ? 'selected' : ''}`} aria-current={e.number === episode ? 'true' : undefined} onClick={() => selectEpisode(e.number)}><span className="episode-number">{e.number}</span><strong>{e.title}</strong></button>)}</div></aside>
    </div>}
  </div>;
}
