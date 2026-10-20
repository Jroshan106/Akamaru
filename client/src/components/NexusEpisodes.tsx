import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Anime } from '../types';
import BackChevron from './BackChevron';
import { LoadingIndicator } from './CatalogUI';
import ProviderPlayer from './ProviderPlayer';
import ThemedSelect from './ThemedSelect';

type Mapping = { malId: number; anilistId: number; episodes: { number: string; title: string }[] };
export default function NexusEpisodes({ anime, initialEpisode, onFallback }: { anime: Anime; initialEpisode?: string; onFallback: () => void }) {
  const navigate = useNavigate();
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [playerAttempt, setPlayerAttempt] = useState(0);
  const [preference, setPreference] = useState(() => {
    try { const value = localStorage.getItem('akamaru-nexus-audio'); return value && ['sub', 'dub', 'multi'].includes(value) ? value : 'sub'; } catch { return 'sub'; }
  });
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(''); setMapping(null);
    void fetch(`/api/nexus/${anime.id}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not find this anime on Movies Nexus.');
      if (!controller.signal.aborted) setMapping(data);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [anime.id, attempt]);
  const episode = initialEpisode || mapping?.episodes[0]?.number;
  const index = mapping?.episodes.findIndex(e => e.number === episode) ?? -1;
  const url = mapping && index >= 0 ? `https://www.moviesnexus.fun/anime/${mapping.anilistId}/${episode}/${preference}?autoNext=0` : '';
  const selectEpisode = (number: string) => navigate(`/anime/${anime.id}/episodes/${number}`);
  return <div className="page watch-page provider-page nexus-page">
    <Link className="back-link" to={`/anime/${anime.id}`}><BackChevron/> {anime.title}</Link>
    <span className="eyebrow">MOVIES NEXUS</span><h1>{anime.title}</h1>
    {busy && <LoadingIndicator>Finding anime and episodes...</LoadingIndicator>}
    {error && <div role="alert"><p>{error}</p><button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Retry anime mapping</button></div>}
    {mapping && <div className="watch-layout aligned-watch-layout">
      <div className="playback-header"><h2>Episode {episode || '—'}{index >= 0 ? ` — ${mapping.episodes[index].title}` : ''}</h2>
        <label className="provider-server">Audio preference<ThemedSelect aria-label="Audio preference" value={preference} onChange={e => { setPreference(e.target.value); try { localStorage.setItem('akamaru-nexus-audio', e.target.value); } catch {} }}><option value="sub">Japanese · Sub</option><option value="dub">English · Dub</option><option value="multi">Multi-audio</option></ThemedSelect></label>
      </div>
      <section>{url ? <ProviderPlayer key={`${url}-${playerAttempt}`} url={url} title={`${anime.title} · Episode ${episode} · Movies Nexus`}/> : <p role="alert">{mapping.episodes.length ? 'This episode is not listed. Choose an episode below.' : 'No aired episodes are listed for this anime yet.'}</p>}
        <p className="muted">Use the controls inside the Movies Nexus player. Episode listings do not guarantee stream availability.</p>
        <div className="episode-controls">{url && <button className="button secondary" onClick={() => setPlayerAttempt(n => n + 1)}>Reload player</button>}<button className="button secondary" onClick={onFallback}>Try Anikoto player</button></div>
        <div className="episode-controls"><button className="button secondary" disabled={index <= 0} onClick={() => selectEpisode(mapping.episodes[index - 1].number)}><BackChevron/> Previous</button><button className="button primary" disabled={index < 0 || index >= mapping.episodes.length - 1} onClick={() => selectEpisode(mapping.episodes[index + 1].number)}>Next <BackChevron forward/></button></div>
      </section>
      <aside><h2>Episodes ({mapping.episodes.length})</h2><div className="provider-episodes" tabIndex={0} role="region" aria-label="Scrollable episode list">{mapping.episodes.map(e => <button key={e.number} className={`episode-row ${e.number === episode ? 'selected' : ''}`} aria-current={e.number === episode ? 'true' : undefined} onClick={() => selectEpisode(e.number)}><span className="episode-number">{e.number}</span><strong>{e.title}</strong></button>)}</div></aside>
    </div>}
    {error && <button className="button secondary" onClick={onFallback}>Try Anikoto player</button>}
  </div>;
}
