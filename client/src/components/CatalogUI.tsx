import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Bookmark, Check, Star, ArrowRight, RotateCw } from "lucide-react";
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
      <span key={String(active)} className="save-icon">{active ? <Check size={18} /> : <Bookmark size={18} />}</span>
    </button>
  );
}
export function AnimeCard({ anime }: { anime: Anime }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <article className="anime-card">
      <div className={`poster ${loaded ? 'poster-ready' : 'poster-loading'}`}>
        <Link to={`/anime/${anime.id}`}>
          <img
            src={anime.coverImage}
            alt={anime.title}
            loading="lazy"
            decoding="async"
            width={300}
            height={425}
            onLoad={() => setLoaded(true)}
            onError={(e) => {
              setLoaded(true);
              if (!e.currentTarget.src.endsWith('/placeholder.svg')) e.currentTarget.src = "/placeholder.svg";
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
        <span className={`poster-tag${anime.status === 'Upcoming' ? ' upcoming-badge' : ''}`}>
          {anime.status === 'Upcoming' ? 'Upcoming' : anime.episodeCount
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
export function LoadingIndicator({ children = 'Finding your next adventure…' }: { children?: React.ReactNode }) {
  return <div className="loading-indicator" role="status"><span className="loading-bars" aria-hidden="true"><i/><i/><i/><i/></span><span>{children}</span></div>;
}
export function CatalogState() {
  const { loading, error, retry } = useCatalog();
  const { pathname } = useLocation();
  const detail = /^\/(anime|watch)\//.test(pathname);
  if (loading && pathname === '/') return <section className="main-loader" role="status" aria-label="Loading Akamaru"><div className="main-loader-emblem" aria-hidden="true"><img src="/apple-touch-icon.png" alt="" width="100" height="100"/><span/></div><span className="eyebrow">YOUR NEXT ADVENTURE</span><h2>A story is waiting.</h2><p>Getting your anime ready...</p><span className="loading-bars" aria-hidden="true"><i/><i/><i/><i/></span></section>;
  if (loading)
    return (
      <section className="catalog-loading" aria-label="Loading anime">
        <LoadingIndicator/>
        {detail ? <div className="skeleton-detail" aria-hidden="true"><div className="skeleton skeleton-cover"/><div><div className="skeleton skeleton-line"/><div className="skeleton skeleton-line short"/><div className="skeleton skeleton-description"/></div></div> : <div className="anime-grid skeleton-grid" aria-hidden="true">{Array.from({length:6}, (_, i) => <div key={i}><div className="skeleton skeleton-cover"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-line short"/></div>)}</div>}
      </section>
    );
  if (error)
    return (
      <div className="empty" role="alert">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button className="button primary" onClick={retry}>
          <RotateCw size={16}/> Try again
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
