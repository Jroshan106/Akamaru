import { Link } from "react-router-dom";
import { ArrowRight, Play, Star, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { RecentWatch } from './HistoryPage';
import SeasonalAnime from '../components/SeasonalAnime';
import { useCatalog } from "../lib/catalog";
import { AnimeCard, CatalogState, SaveButton } from "../components/CatalogUI";
export default function HomePage() {
  const { anime, loading, error } = useCatalog();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const count = Math.min(6, anime.length);
  const slide = count ? index % count : 0;
  const running = !hovered && !focused && !hidden && !reduced;
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!running || loading || error || count < 2) return;
    const timer = window.setTimeout(() => setIndex(i => (i + 1) % count), 6500);
    return () => window.clearTimeout(timer);
  }, [running, loading, error, count, index]);
  if (loading || error) return <><CatalogState /><div className="page"><SeasonalAnime/></div></>;
  const featured = anime[slide];
  if (!featured)
    return <div className="empty">The catalog is coming soon.</div>;
  return (
    <>

      <section className="hero animated-hero" data-running={running} aria-label="Featured anime slideshow" aria-roledescription="carousel" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
        <div className="hero-aurora" aria-hidden="true"><i/><i/><i/></div>
        <img
          key={`art-${featured.id}`}
          className="hero-art"
          src={featured.coverImage}
          alt=""
          fetchPriority="high"
          decoding="async"
          onError={e => { if (!e.currentTarget.src.endsWith("/placeholder.svg")) e.currentTarget.src = "/placeholder.svg"; }}
        />
        <div className="hero-shade" />
        <div className="hero-content" key={`content-${featured.id}`}>
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
              to={`/anime/${featured.id}/episodes`}
            >
              <Play size={18} fill="currentColor" />
              Watch episodes
            </Link>
            <Link className="button secondary" to={`/anime/${featured.id}`}>
              View details <ArrowRight size={17} />
            </Link>
            <SaveButton id={featured.id} />
          </div>
        </div>
        <div className="hero-timer" key={`timer-${slide}-${running}`} aria-hidden="true"><span/></div>
        <div className="hero-bottom">
          <span>
            <b>0{slide + 1}</b> / 0{count}
          </span>
          <div className="hero-dots">
            {anime.slice(0, 6).map((a, i) => (
              <button
                key={a.id}
                aria-label={`Feature ${a.title}`}
                aria-pressed={slide === i}
                className={slide === i ? "active" : ""}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </div>
      </section>
      <div className="page">
        <RecentWatch/>
        <SeasonalAnime/>
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
              .slice(0, 12).map((a) => (
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
