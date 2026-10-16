import { Link } from "react-router-dom";
import { Bookmark, Check, Star, ArrowRight } from "lucide-react";
import type { Anime } from "../types";
import { useCatalog } from "../lib/catalog";
export function SaveButton({ id }: { id: string }) {
  const { saved, toggle } = useCatalog();
  const active = saved.includes(id);
  return (
    <button
      className={`save-button ${active ? "saved" : ""}`}
      aria-label={active ? "Remove from my list" : "Add to my list"}
      aria-pressed={active}
      onClick={() => toggle(id)}
    >
      {active ? <Check size={18} /> : <Bookmark size={18} />}
    </button>
  );
}
export function AnimeCard({ anime }: { anime: Anime }) {
  return (
    <article className="anime-card">
      <div className="poster">
        <Link to={`/anime/${anime.id}`}>
          <img
            src={anime.coverImage}
            alt={anime.title}
            loading="lazy"
            decoding="async"
            width={300}
            height={425}
            onError={(e) => {
              e.currentTarget.src = "/placeholder.svg";
            }}
          />
          <span className="poster-play">
            Explore <ArrowRight size={18} />
          </span>
        </Link>
        <span className="rating">
          <Star size={12} fill="currentColor" />
          {anime.rating ? anime.rating.toFixed(1) : "N/A"}
        </span>
        <SaveButton id={anime.id} />
        <span className="poster-tag">
          {anime.episodeCount
            ? `${anime.episodeCount} episodes`
            : "Episodes TBA"}
        </span>
      </div>
      <Link className="card-title" to={`/anime/${anime.id}`}>
        {anime.title}
      </Link>
      <p>
        {anime.year || "TBA"}
        <span>•</span>
        {anime.genres[0]}
        <span>•</span>
        {anime.mediaType || "Anime"}
      </p>
    </article>
  );
}
export function CatalogState() {
  const { loading, error, retry } = useCatalog();
  if (loading)
    return (
      <div className="empty" role="status">
        <span className="spinner" />
        Loading your next adventure…
      </div>
    );
  if (error)
    return (
      <div className="empty" role="alert">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button className="button primary" onClick={retry}>
          Try again
        </button>
      </div>
    );
  return null;
}
export function NotFound() {
  return (
    <div className="empty">
      <span className="eyebrow">OFF THE MAP</span>
      <h1>This page wandered off.</h1>
      <p>Let’s find you another adventure.</p>
      <Link className="button primary" to="/browse">
        Explore anime
      </Link>
    </div>
  );
}
