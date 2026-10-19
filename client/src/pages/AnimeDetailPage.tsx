import { Link, useParams } from "react-router-dom";
import { Play, Star } from "lucide-react";
import { useCatalog } from "../lib/catalog";
import { CatalogState, NotFound, SaveButton } from "../components/CatalogUI";
import { resolveId } from "../lib/jikan";
export default function AnimeDetailPage() {
  const { id } = useParams();
  const { anime, loading, error } = useCatalog();
  if (loading || error) return <CatalogState />;
  const item = anime.find((a) => a.id === resolveId(id || ""));
  if (!item) return <NotFound />;
  return (
    <div className="page detail-page">
      <Link className="back-link" to="/browse">
        <FontAwesomeIcon icon={byPrefixAndName.fas['chevron-left']} /> Back to anime
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
            {item.episodes[0] && (
              <Link
                className="button secondary"
                to={`/watch/${item.id}/${item.episodes[0].id}`}
              >
                <Play size={18} /> Watch trailer
              </Link>
            )}
            <SaveButton id={item.id} />
          </div>
        </div>
      </section>
      <section className="catalog-section">
        <h2>Trailers & information</h2>
        <p className="muted">
          {item.episodeCount
            ? `${item.episodeCount} episodes listed.`
            : "Episode count not announced."}{" "}
          Tenrai provides anime information and trailers, not full-episode
          streams.
        </p>
        <div className="episode-list">
          {item.episodes.map((e) => (
            <Link
              to={`/watch/${item.id}/${e.id}`}
              className="episode-row"
              key={e.id}
            >
              <span className="episode-number">
                <Play size={20} />
              </span>
              <div>
                <strong>{e.title}</strong>
                <span>YouTube trailer</span>
              </div>
              <Play size={20} />
            </Link>
          ))}
        </div>
        {!item.episodes.length && (
          <p className="muted">No trailer is available for this title yet.</p>
        )}
        <a
          className="text-link"
          href={`https://myanimelist.net/anime/${item.id}`}
          target="_blank"
          rel="noreferrer"
        >
          View on MyAnimeList ↗
        </a>
      </section>
    </div>
  );
}
