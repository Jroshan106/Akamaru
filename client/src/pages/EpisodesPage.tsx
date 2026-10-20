import { useParams } from 'react-router-dom';
import { useCatalog } from '../lib/catalog';
import { resolveId } from '../lib/jikan';
import { CatalogState, NotFound } from '../components/CatalogUI';
import AbyssEpisodes from '../components/AbyssEpisodes';

export default function EpisodesPage() {
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
  if (loading || (error && !item)) return <CatalogState />;
  if (!item) return <NotFound />;
  return <AbyssEpisodes key={item.id} anime={item} initialEpisode={episodeNumber} />;
}
