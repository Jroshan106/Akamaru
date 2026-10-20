import { SeasonSelect } from '../components/AnimeRelations';
import BackChevron from '../components/BackChevron';
import ThemedSelect from '../components/ThemedSelect';
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useCatalog } from '../lib/catalog';
import { resolveId } from '../lib/jikan';
import { CatalogState, NotFound, LoadingIndicator } from '../components/CatalogUI';
import CinemaPlayer from '../components/CinemaPlayer';
import type { Anime } from '../types';
import KotoEpisodes from '../components/KotoEpisodes';
import NexusEpisodes from '../components/NexusEpisodes';

type Match = { slug: string; title: string };
type Episode = { number: string; title: string; sub: boolean; dub: boolean };
type Player = { url: string | null; intro?: [number, number] | null; externalUrl: string; message: string; servers: { id: number; name: string; language: string }[] };

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/anikoto${path}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Anikoto is unavailable. Please try again.');
  return data;
}

export default function EpisodesPage() {
  const [mode, updateMode] = useState(() => {
    try { const saved = localStorage.getItem('akamaru-source'); return saved && ['nexus', 'koto', 'legacy'].includes(saved) ? saved : 'koto'; } catch { return 'koto'; }
  });
  const setMode = (value: string) => {
    updateMode(value);
    try { localStorage.setItem('akamaru-source', value); } catch { /* Session preference still works. */ }
  };
  const { id, episodeNumber } = useParams();
  const { anime, loading, error } = useCatalog();
  const rawId = (id || '').trim();
  const cleanId = decodeURIComponent(rawId).toLowerCase();
  const item = anime.find(a =>
    a.id === rawId ||
    a.id === resolveId(rawId) ||
    a.title.toLowerCase() === cleanId ||
    a.title.toLowerCase().includes(cleanId.replace(/-/g, ' '))
  );

  if (loading) return <CatalogState />;
  if (error && !item) return <CatalogState />;
  if (!item) return <NotFound />;

  return <><div className="page" style={{ paddingBottom: 0 }}><label className="provider-server">Playback source<ThemedSelect aria-label="Playback source" value={mode} onChange={e => setMode(e.target.value)}><option value="nexus">Movies Nexus · Provider player</option><option value="koto">Akamaru · Full controls</option><option value="legacy">Anikoto · Basic controls</option></ThemedSelect></label><p className="muted">{mode === 'nexus' ? 'Watch with Movies Nexus and use its built-in playback controls.' : mode === 'koto' ? 'Choose subtitles, playback speed, and video quality when available for this episode.' : 'Play with basic controls. Switch to Akamaru for subtitle, speed, and quality options.'}</p></div>{mode === 'nexus' ? <NexusEpisodes key={item.id} anime={item} initialEpisode={episodeNumber} onFallback={() => setMode('legacy')} /> : mode === 'koto' ? <KotoEpisodes key={item.id} anime={item} initialEpisode={episodeNumber} onFallback={() => setMode('legacy')} /> : <EpisodeBrowser key={item.id} animeItem={item} initialEpisode={episodeNumber} />}</>;
}

function EpisodeBrowser({ animeItem, initialEpisode }: { animeItem: Anime; initialEpisode?: string }) {
  const navigate = useNavigate();
  const [source, setSource] = useState<Match | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episode, setEpisode] = useState(initialEpisode || '');
  const [server, setServer] = useState(0);
  const [player, setPlayer] = useState<Player | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  // 1. Resolve source anime and load episodes automatically
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setBusy(true);
    setError('');

    async function loadSourceAndEpisodes() {
      try {
        let activeSource = source;
        if (!activeSource) {
          const resolved = await get<{ item: Match }>(`/resolve/${animeItem.id}`, controller.signal);
          if (cancelled) return;
          activeSource = resolved.item;
          setSource(activeSource);
        }

        const epData = await get<{ episodes: Episode[] }>(`/${activeSource.slug}/episodes`, controller.signal);
        if (cancelled) return;
        setEpisodes(epData.episodes);

        if (!epData.episodes.length) {
          throw new Error('No episodes are available for this title yet.');
        }

        const target = (initialEpisode && epData.episodes.some(e => e.number === initialEpisode))
          ? initialEpisode
          : (episode && epData.episodes.some(e => e.number === episode))
            ? episode
            : epData.episodes[0].number;

        setEpisode(target);

        if (initialEpisode !== target) {
          navigate(`/anime/${animeItem.id}/episodes/${target}`, { replace: true });
        }
      } catch (e) {
        if (!cancelled && !controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Unable to load Anikoto episodes.');
        }
      } finally {
        if (!cancelled && !controller.signal.aborted) setBusy(false);
      }
    }

    void loadSourceAndEpisodes();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [animeItem.id, source, retry]);

  // 2. Keep episode in sync when URL changes (e.g. back/forward button)
  useEffect(() => {
    if (initialEpisode && initialEpisode !== episode && episodes.some(e => e.number === initialEpisode)) {
      setEpisode(initialEpisode);
      setServer(0);
      setPlayer(null);
    }
  }, [initialEpisode, episodes]);

  // 3. Load player when source, episode or server changes
  useEffect(() => {
    if (!source || !episode) return;
    const controller = new AbortController();
    let cancelled = false;
    setBusy(true);
    setError('');

    async function loadPlayer() {
      try {
        const data = await get<Player>(`/${source!.slug}/episodes/${episode}/players?server=${server}`, controller.signal);
        if (!cancelled) setPlayer(data);
      } catch (e) {
        if (!cancelled && !controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Unable to load player.');
        }
      } finally {
        if (!cancelled && !controller.signal.aborted) setBusy(false);
      }
    }

    void loadPlayer();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [source, episode, server, retry]);

  const index = episodes.findIndex(e => e.number === episode);

  function selectEpisode(number: string) {
    setPlayer(null);
    setEpisode(number);
    setServer(0);
    navigate(`/anime/${animeItem.id}/episodes/${number}`);
  }

  return (
    <div className="page watch-page provider-page">
      <Link className="back-link" to={`/anime/${animeItem.id}`}><BackChevron /> {animeItem.title}</Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
        <div>
          <span className="eyebrow">EPISODES · ANIKOTO</span>
          <h1 style={{ margin: 0 }}>{source?.title || animeItem.title}</h1>
        </div>
      </div>
      {!episodes.length && <SeasonSelect id={animeItem.id} title={animeItem.title}/>}

      {busy && !player && <LoadingIndicator>Loading episode {episode || '1'}…</LoadingIndicator>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button className="button secondary" onClick={() => setRetry(n => n + 1)}>Try again</button>
        </div>
      )}

      {episodes.length > 0 && (
        <div className="watch-layout aligned-watch-layout">
          <div className="playback-header">
            <SeasonSelect id={animeItem.id} title={animeItem.title}/>
            <h2>Episode {episode || '1'} — {episodes[index]?.title || `Episode ${episode || '1'}`}</h2>
            {player && (
                <label className="provider-server">
                  Server and language
                  <ThemedSelect aria-label="Server and language" value={server} onChange={e => setServer(Number(e.target.value))}>
                    {player.servers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} · {s.language.toUpperCase()}</option>
                    ))}
                  </ThemedSelect>
                </label>
            )}
          </div>
          <section>
            {player && (
              <>
                {player.url ? (
                  <CinemaPlayer
                    key={player.url}
                    historyItem={{ animeId: animeItem.id, title: animeItem.title, cover: animeItem.coverImage, episode: String(episode), source: "legacy" }}
                    url={player.url}
                    intro={player.intro}
                    title={`${source?.title || animeItem.title} · Episode ${episode}`}
                    onNext={index >= 0 && index < episodes.length - 1 ? () => selectEpisode(episodes[index + 1].number) : undefined}
                  />
                ) : (
                  <div className="cinema-unavailable"><p>{player.message}</p></div>
                )}
                <p className="muted">Player hosted by Anikoto’s video provider. Availability may vary.</p>
                <a className="text-link" href={player.externalUrl} target="_blank" rel="noreferrer">
                  Player not working? Open episode on Anikoto ↗
                </a>
              </>
            )}

            <div className="episode-controls">
              <button
                className="button secondary"
                disabled={index <= 0}
                onClick={() => selectEpisode(episodes[index - 1].number)}
              >
                <BackChevron /> Previous
              </button>
              <button
                className="button primary"
                disabled={index < 0 || index >= episodes.length - 1}
                onClick={() => selectEpisode(episodes[index + 1].number)}
              >
                Next <BackChevron forward />
              </button>
            </div>
          </section>

          <aside>
            <h2>Episodes ({episodes.length})</h2>
            <div className="provider-episodes" tabIndex={0} role="region" aria-label="Scrollable episode list">
              {episodes.map(e => (
                <button
                  key={e.number}
                  className={`episode-row ${e.number === episode ? 'selected' : ''}`}
                  aria-current={e.number === episode ? 'true' : undefined}
                  onClick={() => selectEpisode(e.number)}
                >
                  <span className="episode-number">{e.number}</span>
                  <div>
                    <strong>{e.title || `Episode ${e.number}`}</strong>
                    <span>{[e.sub && 'Sub', e.dub && 'Dub'].filter(Boolean).join(' · ')}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
