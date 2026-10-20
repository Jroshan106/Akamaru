import { useEffect, useState } from 'react';
import { jikanRequest, normalizeAnime, JikanResult } from './jikan';
import { useCatalog } from './catalog';
import type { Anime } from '../types';
export const seasonNames = ['Winter', 'Spring', 'Summer', 'Fall'] as const;
export function useCurrentSeason() {
  const [date] = useState(() => new Date());
  const name = seasonNames[Math.floor(date.getMonth() / 3)];
  const year = date.getFullYear();
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const { remember } = useCatalog();
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    jikanRequest<JikanResult>(`/seasons/${year}/${name.toLowerCase()}?limit=10&order_by=score&sort=desc&sfw=true`).then(result => {
      if (cancelled) return;
      const titles = [...new Map(result.data.map(a => [a.mal_id, normalizeAnime(a)])).values()].sort((a,b) => b.rating-a.rating);
      setItems(titles); remember(titles);
    }).catch(() => { if (!cancelled) setError('This season could not load.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [name, year, attempt, remember]);
  return { items, name, year, loading, error, retry: () => setAttempt(n=>n+1) };
}
