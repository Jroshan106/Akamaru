import { Link, useParams } from "react-router-dom";
import { Play, Star } from "lucide-react";
import { useCatalog } from "../lib/catalog";
import { CatalogState, NotFound, SaveButton } from "../components/CatalogUI";
export default function AnimeDetailPage() {
  const { id } = useParams();
  const { anime, loading, error } = useCatalog();
  if (loading || error) return <CatalogState />;
  const item = anime.find((a) => a.id === id);
  if (!item) return <NotFound />;
  return (
    <div className="page detail-page">
      <Link className="back-link" to="/browse">
        ← Back to anime
      </Link>
      <section className="detail-layout">
        <img className="detail-poster" src={item.coverImage} alt={item.title} />
        <div>
          <span className="eyebrow">{item.studio}</span>
          <h1>{item.title}</h1>
          <p className="japanese-title">{item.japaneseTitle}</p>
          <div className="hero-meta">
            <span className="gold">
              <Star size={16} /> {item.rating.toFixed(1)}
            </span>
            <span>{item.year}</span>
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
            {item.episodes[0] && (
              <Link
                className="button primary"
                to={`/watch/${item.id}/${item.episodes[0].id}`}
              >
                <Play size={18} /> Watch preview
              </Link>
            )}
            <SaveButton id={item.id} />
          </div>
        </div>
      </section>
      <section className="catalog-section">
        <h2>Episode guide</h2>
        <p className="muted">
          Demo entries link to external YouTube previews, not verified full
          episodes.
        </p>
        <div className="episode-list">
          {item.episodes.map((e) => (
            <Link
              to={`/watch/${item.id}/${e.id}`}
              className="episode-row"
              key={e.id}
            >
              <span className="episode-number">
                {String(e.number).padStart(2, "0")}
              </span>
              <div>
                <strong>{e.title}</strong>
                <span>Video preview</span>
              </div>
              <Play size={20} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
