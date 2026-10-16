import { Link } from "react-router-dom";
import { ArrowRight, Play, Star, Sparkles } from "lucide-react";
import { useState } from "react";
import { useCatalog } from "../lib/catalog";
import { AnimeCard, CatalogState, SaveButton } from "../components/CatalogUI";
export default function HomePage() {
  const { anime, loading, error } = useCatalog();
  const [index, setIndex] = useState(0);
  if (loading || error) return <CatalogState />;
  const featured = anime[index];
  if (!featured)
    return <div className="empty">The catalog is coming soon.</div>;
  return (
    <>
      <section className="hero">
        <div
          className="hero-art"
          style={{ backgroundImage: `url(${featured.coverImage})` }}
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="eyebrow">
            <Sparkles size={14} /> THE SPOTLIGHT
          </span>
          <h1>{featured.title}</h1>
          <div className="hero-meta">
            <span className="gold">
              <Star size={15} fill="currentColor" />{" "}
              {featured.rating ? featured.rating.toFixed(1) : "Not rated"}
            </span>
            <span>{featured.year || "TBA"}</span>
            <span>{featured.mediaType || "Anime"}</span>
            <span className="badge">{featured.status}</span>
          </div>
          <p>{featured.synopsis}</p>
          <div className="genre-tags">
            {featured.genres.slice(0, 3).map((g) => (
              <Link to={`/browse?genre=${encodeURIComponent(g)}`} key={g}>
                {g}
              </Link>
            ))}
          </div>
          <div className="hero-actions">
            <Link
              className="button primary"
              to={
                featured.episodes[0]
                  ? `/watch/${featured.id}/${featured.episodes[0].id}`
                  : `/anime/${featured.id}`
              }
            >
              <Play size={18} fill="currentColor" />
              {featured.episodes[0] ? "Watch trailer" : "Explore anime"}
            </Link>
            <Link className="button secondary" to={`/anime/${featured.id}`}>
              View details <ArrowRight size={17} />
            </Link>
            <SaveButton id={featured.id} />
          </div>
        </div>
        <div className="hero-bottom">
          <span>
            <b>0{index + 1}</b> / 0{Math.min(6, anime.length)}
          </span>
          <div className="hero-dots">
            {anime.slice(0, 6).map((a, i) => (
              <button
                key={a.id}
                aria-label={`Feature ${a.title}`}
                aria-pressed={index === i}
                className={index === i ? "active" : ""}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <span className="hero-caption">FIND YOUR NEXT OBSESSION</span>
        </div>
      </section>
      <div className="page">
        <section className="catalog-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR NEXT GREAT STORY</span>
              <h2>
                Worth the hype<span className="accent">.</span>
              </h2>
            </div>
            <Link to="/browse">
              Explore all <ArrowRight size={17} />
            </Link>
          </div>
          <div className="anime-grid">
            {[...anime]
              .sort((a, b) => b.rating - a.rating)
              .map((a) => (
                <AnimeCard anime={a} key={a.id} />
              ))}
          </div>
        </section>
        <section className="discovery-strip">
          <div>
            <span className="eyebrow">FOLLOW YOUR MOOD</span>
            <h2>A world for every you.</h2>
            <p>Epic battles, everyday magic, and everything in between.</p>
          </div>
          <div className="mood-links">
            {["Action", "Adventure", "Comedy", "Fantasy"].map((g, i) => (
              <Link to={`/browse?genre=${g}`} key={g}>
                <span>0{i + 1}</span>
                {g}
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
