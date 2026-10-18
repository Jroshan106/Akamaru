import ThemedSelect from '../components/ThemedSelect';
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useCatalog } from '../lib/catalog';
import { resolveId } from '../lib/jikan';
import { CatalogState, NotFound, LoadingIndicator } from '../components/CatalogUI';
import CinemaPlayer from '../components/CinemaPlayer';
import type { Anime } from '../types';
import KotoEpisodes from '../components/KotoEpisodes';

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
    try { return localStorage.getItem('akamaru-source') === 'koto' ? 'koto' : 'legacy'; } catch { return 'legacy'; }
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

  return <><div className="page" style={{ paddingBottom: 0 }}><label className="provider-server">Playback source<ThemedSelect aria-label="Playback source" value={mode} onChange={e => setMode(e.target.value)}><option value="legacy">Anikoto · Embedded source</option><option value="koto">Koto · Direct source</option></ThemedSelect></label><p className="muted">{mode === 'koto' ? 'Direct playback supports quality and captions when provided. This source may be unavailable on the deployed site.' : 'Episodes come from an external provider. Available controls and playback depend on that provider.'}</p></div>{mode === 'koto' ? <KotoEpisodes key={item.id} anime={item} initialEpisode={episodeNumber} onFallback={() => setMode('legacy')} /> : <EpisodeBrowser key={item.id} animeItem={item} initialEpisode={episodeNumber} />}</>;
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState(animeItem.title);
  const [matches, setMatches] = useState<Match[]>([]);

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
          const q = searchQuery.trim() || animeItem.title;
          const searchRes = await get<{ items: Match[] }>(`/search?q=${encodeURIComponent(q)}`, controller.signal);
          let items = searchRes.items || [];
          if (cancelled) return;
          setMatches(items);

          if (!items.length && animeItem.japaneseTitle) {
            const jpRes = await get<{ items: Match[] }>(`/search?q=${encodeURIComponent(animeItem.japaneseTitle)}`, controller.signal);
            if (jpRes.items?.length) items = jpRes.items;
          }

          if (!items.length) {
            const simplified = q.replace(/[:\-–—].*$/, '').trim();
            if (simplified && simplified.toLowerCase() !== q.toLowerCase()) {
              const simpRes = await get<{ items: Match[] }>(`/search?q=${encodeURIComponent(simplified)}`, controller.signal);
              if (simpRes.items?.length) items = simpRes.items;
            }
          }

          if (!items.length) {
            throw new Error(`No matching video streams were found for "${animeItem.title}".`);
          }

          const exact = items.find(m => m.title.toLowerCase() === animeItem.title.toLowerCase());
          setMatches(items);
          if (!exact) {
            setShowSearch(true);
            throw new Error('Choose the matching title and season below to load episodes.');
          }
          activeSource = exact;
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

  async function handleManualSearch() {
    if (!searchQuery.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await get<{ items: Match[] }>(`/search?q=${encodeURIComponent(searchQuery.trim())}`, AbortSignal.timeout(8000));
      setMatches(res.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page watch-page provider-page">
      <Link className="back-link" to={`/anime/${animeItem.id}`}>← {animeItem.title}</Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
        <div>
          <span className="eyebrow">EPISODES · ANIKOTO</span>
          <h1 style={{ margin: 0 }}>{source?.title || animeItem.title}</h1>
        </div>
        <button
          className="text-link"
          onClick={() => setShowSearch(s => !s)}
          style={{ fontSize: '13px', cursor: 'pointer' }}
        >
          {showSearch ? 'Hide search' : 'Change season / search'}
        </button>
      </div>

      {showSearch && (
        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '12px', margin: '12px 0 20px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <form className="provider-search" onSubmit={e => { e.preventDefault(); void handleManualSearch(); }} style={{ marginBottom: matches.length ? '12px' : 0 }}>
            <input
              aria-label="Search Anikoto"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              maxLength={180}
              placeholder="Search title or season…"
              required
            />
            <button className="button primary" type="submit">Search</button>
          </form>
          {matches.length > 0 && (
            <div className="episode-list" style={{ maxHeight: '220px', overflowY: 'auto' }}>
              {matches.map(m => (
                <button
                  key={m.slug}
                  className={`episode-row ${source?.slug === m.slug ? 'selected' : ''}`}
                  onClick={() => {
                    setSource(m);
                    setEpisodes([]);
                    setPlayer(null);
                    setShowSearch(false);
                    setRetry(n => n + 1);
                  }}
                >
                  <strong>{m.title}</strong>
                  <span>{source?.slug === m.slug ? 'Current' : 'Select season →'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {busy && !player && <LoadingIndicator>Loading episode {episode || '1'}…</LoadingIndicator>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button className="button secondary" onClick={() => setRetry(n => n + 1)}>Try again</button>
        </div>
      )}

      {episodes.length > 0 && (
        <div className="watch-layout">
          <section>
            <h2>Episode {episode || '1'} — {episodes[index]?.title || `Episode ${episode || '1'}`}</h2>
            {player && (
              <>
                <label className="provider-server">
                  Server and language
                  <ThemedSelect aria-label="Server and language" value={server} onChange={e => setServer(Number(e.target.value))}>
                    {player.servers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} · {s.language.toUpperCase()}</option>
                    ))}
                  </ThemedSelect>
                </label>
                {player.url ? (
                  <CinemaPlayer
                    key={player.url}
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
                ← Previous
              </button>
              <button
                className="button primary"
                disabled={index < 0 || index >= episodes.length - 1}
                onClick={() => selectEpisode(episodes[index + 1].number)}
              >
                Next →
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



