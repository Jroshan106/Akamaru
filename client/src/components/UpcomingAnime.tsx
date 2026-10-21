import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { jikanRequest, normalizeAnime, type JikanResult } from '../lib/jikan';
import { useCatalog } from '../lib/catalog';
import { AnimeCard, LoadingIndicator } from './CatalogUI';
import type { Anime } from '../types';

export default function UpcomingAnime() {
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { remember } = useCatalog();

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false);
    jikanRequest<JikanResult>('/anime?status=upcoming&order_by=members&sort=desc&limit=12&sfw=true')
      .then(result => {
        if (cancelled) return;
        const titles = [...new Map(result.data
          .filter(item => item.status === 'Not yet aired')
          .map(item => [item.mal_id, normalizeAnime(item)])).values()];
        remember(titles); setItems(titles);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt, remember]);

  return <section className="catalog-section" aria-labelledby="upcoming-heading">
    <div className="section-heading">
      <div><span className="eyebrow">COMING SOON</span><h2 id="upcoming-heading">Upcoming anime<span className="accent">.</span></h2></div>
      <Link to="/browse?status=Upcoming">View all <ArrowRight size={17}/></Link>
    </div>
    {loading ? <LoadingIndicator>Loading upcoming anime…</LoadingIndicator>
      : error ? <div className="source-note" role="alert"><p>Upcoming anime could not load.</p><button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>
      : items.length ? <div className="anime-grid">{items.map(item => <AnimeCard anime={item} key={item.id}/>)}</div>
      : <p className="muted">No upcoming anime are listed yet.</p>}
  </section>;
}
