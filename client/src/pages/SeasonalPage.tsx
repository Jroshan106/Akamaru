import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Snowflake, Flower2, Sun, Leaf } from 'lucide-react';
import { AnimeCard, LoadingIndicator } from '../components/CatalogUI';
import BackChevron from '../components/BackChevron';
import ThemedSelect from '../components/ThemedSelect';
import { jikanRequest, normalizeAnime, type JikanResult } from '../lib/jikan';
import { useCatalog } from '../lib/catalog';
import type { Anime } from '../types';

const seasons = [
  { name: 'winter', icon: Snowflake }, { name: 'spring', icon: Flower2 },
  { name: 'summer', icon: Sun }, { name: 'fall', icon: Leaf },
];
type ArchiveYear = { year: number; seasons: string[] };

export default function SeasonalPage() {
  const [params, setParams] = useSearchParams();
  const [today] = useState(() => new Date());
  const [archive, setArchive] = useState<ArchiveYear[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const { remember } = useCatalog();

  useEffect(() => {
    let cancelled = false;
    setArchiveLoading(true); setArchiveError(false);
    jikanRequest<{ data: ArchiveYear[] }>('/seasons').then(result => {
      if (cancelled) return;
      setArchive(result.data.filter(entry => Number.isInteger(entry.year) && entry.year >= 1000 && entry.year <= 2999 && Array.isArray(entry.seasons))
        .map(entry => ({ year: entry.year, seasons: entry.seasons.filter(name => seasons.some(s => s.name === name)) }))
        .filter(entry => entry.seasons.length).sort((a, b) => b.year - a.year));
    }).catch(() => { if (!cancelled) setArchiveError(true); })
      .finally(() => { if (!cancelled) setArchiveLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  const requestedYear = Number(params.get('year')) || today.getFullYear();
  const selectedYear = archive.find(entry => entry.year === requestedYear) || archive.find(entry => entry.year === today.getFullYear()) || archive[0];
  const year = selectedYear?.year;
  const requestedSeason = params.get('season') || seasons[Math.floor(today.getMonth() / 3)].name;
  const season = selectedYear?.seasons.includes(requestedSeason) ? requestedSeason : selectedYear?.seasons[0];
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));

  useEffect(() => {
    if (!year || !season || archiveLoading || archiveError) return;
    let cancelled = false;
    setLoading(true); setError(false); setItems([]); setHasNext(false);
    jikanRequest<JikanResult>(`/seasons/${year}/${season}?page=${page}&limit=24&sfw=true`).then(result => {
      if (cancelled) return;
      const titles = [...new Map(result.data.map(item => [item.mal_id, normalizeAnime(item)])).values()];
      setItems(titles); remember(titles); setHasNext(result.pagination?.has_next_page || false);
    }).catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, season, page, attempt, remember, archiveLoading, archiveError]);

  function select(nextYear: number, nextSeason: string, nextPage = 1) {
    setParams({ year: String(nextYear), season: nextSeason, ...(nextPage > 1 ? { page: String(nextPage) } : {}) });
  }

  return <div className="page browse-page seasonal-page">
    <span className="eyebrow">A SEASON FOR EVERY STORY</span>
    <h1>Seasonal anime<span className="accent">.</span></h1>
    <p className="muted">Explore every year and season in the anime archive.</p>
    {archiveLoading ? <LoadingIndicator>Loading the seasonal archive…</LoadingIndicator>
      : archiveError ? <div role="alert"><p>The seasonal archive could not load.</p><button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>
      : !selectedYear ? <p className="muted">No seasonal years are listed yet.</p>
      : <>
        <div className="season-year-control"><label>Year<ThemedSelect aria-label="Year" value={String(year)} onChange={event => {
          const next = archive.find(entry => entry.year === Number(event.target.value))!;
          select(next.year, next.seasons.includes(season!) ? season! : next.seasons[0]);
        }}>{archive.map(entry => <option key={entry.year} value={entry.year}>{entry.year}</option>)}</ThemedSelect></label></div>
        <div className="season-tabs" role="group" aria-label="Choose season">{seasons.map(({name, icon: Icon}) => <button type="button" key={name} disabled={!selectedYear.seasons.includes(name)} aria-pressed={season === name} onClick={() => select(year!, name)}><Icon size={18}/>{name[0].toUpperCase() + name.slice(1)}</button>)}</div>
        <h2>{season![0].toUpperCase() + season!.slice(1)} {year}</h2>
        {loading ? <LoadingIndicator>Loading seasonal anime…</LoadingIndicator>
          : error ? <div role="alert"><p>This season could not load.</p><button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>
          : items.length ? <><p className="muted">Page {page}</p><div className="anime-grid">{items.map(item => <AnimeCard key={item.id} anime={item}/>)}</div></>
          : <p className="muted">No anime are listed for this season yet.</p>}
        {!loading && !error && (page > 1 || hasNext) && <nav className="episode-controls" aria-label="Season pages">
          <button className="button secondary" disabled={page <= 1} onClick={() => select(year!, season!, page - 1)}><BackChevron/> Previous page</button>
          <button className="button primary" disabled={!hasNext} onClick={() => select(year!, season!, page + 1)}>Next page <BackChevron forward/></button>
        </nav>}
      </>}
  </div>;
}
