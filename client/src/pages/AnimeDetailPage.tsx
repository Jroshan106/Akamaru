import { Link, useParams } from "react-router-dom";
import { Play, Star, Clapperboard } from "lucide-react";
import { useCatalog } from "../lib/catalog";
import { CatalogState, NotFound, SaveButton } from "../components/CatalogUI";
import { resolveId } from "../lib/jikan";
import AnimeRelations from '../components/AnimeRelations';
import MalTracker from '../components/MalTracker';
export default function AnimeDetailPage() {
  const { id } = useParams();
  const { anime, loading, error } = useCatalog();
  if (loading || error) return <CatalogState />;
  const item = anime.find((a) => a.id === resolveId(id || ""));
  if (!item) return <NotFound />;
  return (
    <div className="page detail-page">
      <Link className="back-link" to="/browse">
        <BackChevron /> Back to anime
      </Link>
      <section className="detail-layout">
        <img className="detail-poster" src={item.coverImage} alt={item.title} />
        <div>
          <span className="eyebrow">{item.studio}</span>
          <h1>{item.title}</h1>
          <p className="japanese-title">{item.japaneseTitle}</p>
          <div className="hero-meta">
            <span className="gold">
              <Star size={16} />{" "}
              {item.rating ? item.rating.toFixed(1) : "Not rated"}
            </span>
            <span>{item.year || "TBA"}</span>
            <span>{item.status}</span>
          </div>
          <p className="synopsis">{item.synopsis}</p>
          <div className="genre-tags">
            {item.genres.map((g) => (
              <Link key={g} to={`/browse?genre=${encodeURIComponent(g)}`}>
                {g}
              </Link>
            ))}
          </div>
          <div className="hero-actions">
            <Link className="button primary" to={`/anime/${item.id}/episodes`}><Play size={18} /> Watch episodes</Link>
            <SaveButton id={item.id} /><MalTracker id={item.id} title={item.title} />
            {item.episodes.some(e => e.id === 'trailer') && <Link className="save-button" to={`/watch/${item.id}/trailer`} aria-label="Watch trailer" title="Watch trailer"><Clapperboard size={20}/></Link>}
          </div>
        </div>
      </section>
      <AnimeRelations id={item.id}/>
    </div>
  );
}
import BackChevron from '../components/BackChevron';
