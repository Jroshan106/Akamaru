import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jikanRequest, normalizeAnime, type JikanAnime } from '../lib/jikan';
import type { Anime } from '../types';
import { AnimeCard } from './CatalogUI';
import ThemedSelect from './ThemedSelect';
type Relation = { relation: string; entry: { mal_id: number; type: string; name: string }[] };
function useRelations(id: string) {
  const [items, setItems] = useState<Relation[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setItems([]); setError(false);
    jikanRequest<{data: Relation[]}>(`/anime/${id}/relations`).then(r => { if (!cancelled) setItems(r.data); }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, attempt]);
  return { items, loading, error, retry: () => setAttempt(n=>n+1) };
}
export function SeasonSelect({ id, title }: { id: string; title: string }) {
  const { items, loading, error, retry } = useRelations(id);
  const navigate = useNavigate();
  const entries = [...new Map(items.filter(r => ['prequel','sequel','parent story','side story','spin-off','alternative version','alternative setting'].includes(r.relation.toLowerCase())).flatMap(r => r.entry.filter(e => e.type === 'anime' && String(e.mal_id) !== id).map(e => [e.mal_id, { ...e, relation:r.relation }] as const))).values()];
  return <div className="season-selector"><label>Change seasons<ThemedSelect aria-label="Change seasons" value={id} disabled={loading || !entries.length} onChange={e => navigate(`/anime/${e.target.value}/episodes/1`)}><option value={id}>{title} (current)</option>{entries.map(e => <option key={e.mal_id} value={String(e.mal_id)}>{e.relation}: {e.name}</option>)}</ThemedSelect></label>{loading ? <small>Loading related seasons...</small> : error ? <button className="text-link" onClick={retry}>Retry seasons</button> : !entries.length ? <small>No related seasons listed.</small> : null}</div>;
}
export default function AnimeRelations({id}: {id:string}) {
  const {items, loading, error, retry} = useRelations(id);
  const [details, setDetails] = useState<{ anime: Anime; relation: string }[]>([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setDetails([]); setFailed(false);
    const entries = [...new Map(items.flatMap(r => r.entry.filter(e => e.type === 'anime' && String(e.mal_id) !== id).map(e => [e.mal_id, { ...e, relation: r.relation }] as const))).values()];
    setPending(entries.length > 0);
    void (async () => {
      for (const entry of entries) {
        if (cancelled) return;
        try {
          const result = await jikanRequest<{ data: JikanAnime }>(`/anime/${entry.mal_id}`);
          if (!cancelled) setDetails(current => [...current, { anime: normalizeAnime(result.data), relation: entry.relation }]);
        } catch { if (!cancelled) setFailed(true); }
      }
      if (!cancelled) setPending(false);
    })();
    return () => { cancelled = true; };
  }, [items, id, attempt]);
  const related = details.filter(d => d.anime.mediaType !== 'Music');
  const music = details.filter(d => d.anime.mediaType === 'Music');
  const cards = (entries: typeof details) => <div className="anime-grid relations-grid">{entries.map(({anime, relation}) => <div className="related-card" key={anime.id}><span className="eyebrow relation-label">{anime.mediaType === 'Music' ? 'Music video' : relation}</span><AnimeCard anime={anime}/></div>)}</div>;
  return <section className="catalog-section"><h2>Related anime</h2>{related.length > 0 && cards(related)}{(loading || pending) && <p role="status">Loading related anime...</p>}{error && <button className="button secondary" onClick={retry}>Retry relations</button>}{failed && <button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Retry missing posters</button>}{!loading && !pending && !error && !failed && !related.length && <p className="muted">No related anime are listed yet.</p>}{music.length > 0 && <section className="related-music"><h2>Openings &amp; endings</h2><p className="muted">Related music videos and theme songs.</p>{cards(music)}</section>}</section>;
}
