import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Anime } from '../types';
import BackChevron from './BackChevron';
import { LoadingIndicator } from './CatalogUI';
import ProviderPlayer from './ProviderPlayer';
import { resolveEpisodePlayback, type EpisodePlayback, type PlaybackEpisode } from '../lib/episodePlayback';

type Mapping = { malId: number; anilistId: number; episodes: { number: string; title: string }[] };
export default function RavokEpisodes({ anime, initialEpisode }: { anime: Anime; initialEpisode?: string }) {
  const navigate = useNavigate();
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [playerAttempt, setPlayerAttempt] = useState(0);
  const [playback, setPlayback] = useState<EpisodePlayback | null>(null);
  const [playerBusy, setPlayerBusy] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [providerEpisodes, setProviderEpisodes] = useState<{ animeId: string; items: PlaybackEpisode[] } | null>(null);
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
  const episodes = mapping?.episodes.length ? mapping.episodes : providerEpisodes?.animeId === anime.id ? providerEpisodes.items : [];
  const episode = initialEpisode || episodes[0]?.number || '1';
  const index = episodes.findIndex(e => e.number === episode);
  const canTry = /^[1-9]\d{0,4}$/.test(episode);
  const [episodeInput, setEpisodeInput] = useState(episode);
  useEffect(() => setEpisodeInput(episode), [episode]);
  const anilistId = mapping?.anilistId;
  useEffect(() => {
    setPlayback(null); setPlayerError('');
    if (busy || !canTry) { setPlayerBusy(false); return; }
    const controller = new AbortController();
    setPlayerBusy(true);
    void resolveEpisodePlayback({ malId: anime.id, anilistId, episode, refresh: playerAttempt > 0 }, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        setPlayback(data);
        if (data.episodes?.length) setProviderEpisodes({ animeId: anime.id, items: data.episodes });
      })
      .catch(e => { if (!controller.signal.aborted) setPlayerError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setPlayerBusy(false); });
    return () => controller.abort();
  }, [anime.id, anilistId, episode, canTry, busy, playerAttempt]);
  const players = playback?.players || [];
  const selected = players[0];
  const url = selected?.url || '';
  const selectEpisode = (number: string) => navigate(`/anime/${anime.id}/episodes/${number}`);
  return <div className="page watch-page provider-page ravok-page">
    <Link className="back-link" to={`/anime/${anime.id}`}><BackChevron/> {anime.title}</Link>
    <span className="eyebrow">{playback?.provider === 'anikoto' ? 'ANIKOTO PLAYER' : 'RAVOK PLAYER'}</span><h1>{anime.title}</h1>
    {busy && <LoadingIndicator>Finding anime and episodes...</LoadingIndicator>}
    {!busy && error && <div role="status"><p>Episode details are temporarily unavailable. Trying Anikoto for this anime.</p><button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Retry episode details</button></div>}
    {!busy && <div className="watch-layout aligned-watch-layout">
      <div className="playback-header"><h2>Episode {episode}{index >= 0 ? ` — ${episodes[index].title}` : ''}</h2>
      </div>
      <section>
        {playerBusy && <LoadingIndicator>Loading episode player...</LoadingIndicator>}
        {playerError && <p role="alert">{playerError}</p>}
        {url && <ProviderPlayer key={`${url}-${playerAttempt}`} url={url} title={`${anime.title} · Episode ${episode} · ${selected.language}`} referrerPolicy="origin" sandbox={playback?.provider === 'ravok' ? 'allow-scripts allow-same-origin allow-presentation allow-forms' : undefined}/>}
        {!canTry && <p role="alert">This episode is not listed. Choose another episode below.</p>}
        {canTry && index < 0 && episodes.length > 0 && <p className="muted">This episode is not in the current episode list. Trying available players.</p>}
        {playback?.provider === 'anikoto' ? <p className="muted" role="status">Ravok is unavailable for this episode. Switched to Anikoto · {selected.language}.</p> : <p className="muted">Use the audio and subtitle controls inside the player. Available tracks vary by episode.</p>}
        {canTry && <div className="episode-controls"><button className="button secondary" disabled={playerBusy} onClick={() => setPlayerAttempt(n => n + 1)}>{playerError ? 'Retry player' : playback?.provider === 'anikoto' ? 'Retry Ravok' : 'Reload player'}</button></div>}
        <div className="episode-controls"><button className="button secondary" disabled={index <= 0} onClick={() => selectEpisode(episodes[index - 1].number)}><BackChevron/> Previous</button><button className="button primary" disabled={index < 0 || index >= episodes.length - 1} onClick={() => selectEpisode(episodes[index + 1].number)}>Next <BackChevron forward/></button></div>
      </section>
      <aside><h2>{episodes.length ? `Episodes (${episodes.length})` : 'Choose an episode'}</h2>{episodes.length ? <div className="provider-episodes" tabIndex={0} role="region" aria-label="Scrollable episode list">{episodes.map(e => <button key={e.number} className={`episode-row ${e.number === episode ? 'selected' : ''}`} aria-current={e.number === episode ? 'true' : undefined} onClick={() => selectEpisode(e.number)}><span className="episode-number">{e.number}</span><strong>{e.title}</strong></button>)}</div> : <><p className="muted">The episode list is not available yet. Trying episode {episode}; enter a different episode if needed.</p><form className="manual-episode" onSubmit={e => { e.preventDefault(); if (/^[1-9]\d{0,4}$/.test(episodeInput)) selectEpisode(episodeInput); }}><label>Episode number<input aria-label="Episode number" type="number" min="1" max="99999" step="1" required value={episodeInput} onChange={e => setEpisodeInput(e.target.value)}/></label><button className="button primary" type="submit">Watch episode</button></form></>}</aside>
    </div>}
  </div>;
}
