import { useEffect, useState } from 'react';
import { Snowflake, Flower2, Sun, Leaf } from 'lucide-react';
import { jikanRequest, normalizeAnime, type JikanResult } from '../lib/jikan';
import { useCatalog } from '../lib/catalog';
import { AnimeCard, LoadingIndicator } from './CatalogUI';
import type { Anime } from '../types';

const seasons = [
  { name: 'Winter', icon: Snowflake }, { name: 'Spring', icon: Flower2 },
  { name: 'Summer', icon: Sun }, { name: 'Fall', icon: Leaf },
];
export default function SeasonalAnime() {
  const [year] = useState(() => new Date().getFullYear());
  const [season, setSeason] = useState(() => Math.floor(new Date().getMonth() / 3));
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const { remember } = useCatalog();
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setItems([]);
    jikanRequest<JikanResult>(`/seasons/${year}/${seasons[season].name.toLowerCase()}?limit=10&order_by=score&sort=desc&sfw=true`)
      .then(result => {
        if (cancelled) return;
        const titles = [...new Map(result.data.map(item => [item.mal_id, normalizeAnime(item)])).values()].slice(0, 10);
        remember(titles); setItems(titles);
      }).catch(() => { if (!cancelled) setError('Seasonal anime could not load. Please try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, season, retry, remember]);
  return <section className="catalog-section seasonal-section" aria-labelledby="season-heading">
    <div className="section-heading"><div><span className="eyebrow">THE SEASON’S STANDOUTS · {year}</span><h2 id="season-heading">{seasons[season].name} top 10<span className="accent">.</span></h2></div><span className="muted">Highest rated · MyAnimeList scores</span></div>
    <div className="season-tabs" aria-label="Choose anime season">{seasons.map(({name, icon: Icon}, index) => <button type="button" key={name} aria-pressed={season === index} onClick={() => setSeason(index)}><Icon size={18}/>{name}</button>)}</div>
    {loading ? <><LoadingIndicator>Loading {seasons[season].name.toLowerCase()} anime…</LoadingIndicator><div className="season-grid" aria-hidden="true">{Array.from({length:5},(_, i) => <div className="skeleton skeleton-cover" key={i}/>)}</div></> : error ? <div className="source-note" role="alert"><p>{error}</p><button className="button secondary" onClick={() => setRetry(n => n + 1)}>Try again</button></div> : items.length ? <div className="season-grid">{items.map((item,index) => <div className="season-card" key={`${season}-${item.id}`}><span className="season-rank">#{index + 1}</span><AnimeCard anime={item}/></div>)}</div> : <p className="source-note">No anime are listed for this season yet.</p>}
  </section>;
}
