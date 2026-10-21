import BackChevron from '../components/BackChevron';
import ThemedSelect from '../components/ThemedSelect';
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useCatalog } from "../lib/catalog";
import { AnimeCard, CatalogState } from "../components/CatalogUI";
export default function BrowsePage({
  watchlist = false,
}: {
  watchlist?: boolean;
}) {
  const { anime, loading, error, saved, genres, hasNext, total } = useCatalog();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const genre = params.get("genre") || "";
  const language = params.get("language") || "";
  const sort = params.get("sort") || "rating";
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete('status');
    if (key !== "page") next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const results = anime
    .filter(
      (a) =>
        !watchlist ||
        ((!watchlist || saved.includes(a.id)) &&
          `${a.title} ${a.japaneseTitle} ${a.synopsis}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (!genre || a.genres.includes(genre))),
    )
    .sort((a, b) =>
      !watchlist
        ? 0
        : sort === "title"
          ? a.title.localeCompare(b.title)
          : sort === "year"
            ? b.year - a.year
            : b.rating - a.rating,
    );
  return (
    <div className="page browse-page">
      <span className="eyebrow">
        {watchlist ? "SAVED FOR YOUR NEXT SESSION" : "A NEW ADVENTURE AWAITS"}
      </span>
      <h1>
        {watchlist ? "My list" : "Explore anime"}
        <span className="accent">.</span>
      </h1>
      <p className="muted">
        {watchlist
          ? "All your favorites, in one place. Saved on this browser."
          : "Find the story you’ll wish you discovered sooner."}
      </p>
      <div className="filters">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search catalog"
            placeholder="Search anime…"
            value={search}
            onChange={(e) => update("search", e.target.value)}
          />
        </label>
        <label>
          Genre
          <ThemedSelect
            aria-label="Genre"
            value={genre}
            onChange={(e) => update("genre", e.target.value)}
          >
            <option value="">All genres</option>
            {(watchlist
              ? [...new Set(anime.flatMap((a) => a.genres))].sort()
              : genres.map((g) => g.name)
            ).map((g) => (
              <option key={g}>{g}</option>
            ))}
          </ThemedSelect>
        </label>
        <label>
          Language
          <ThemedSelect
            aria-label="Language"
            value={language}
            onChange={(e) => update("language", e.target.value)}
          >
            <option value="">All languages</option>
            <option value="sub">Japanese · Sub</option>
            <option value="dub">English · Dub</option>
          </ThemedSelect>
        </label>
        <label>
          Sort by
          <ThemedSelect aria-label="Sort by" value={sort} onChange={(e) => update("sort", e.target.value)}>
            <option value="rating">Top rated</option>
            <option value="year">Newest</option>
            <option value="title">A–Z</option>
          </ThemedSelect>
        </label>
      </div>
      {language && <p className="muted">Sub and dub listings from Anikoto. Availability can vary by episode.</p>}
      {loading || error ? (
        <CatalogState />
      ) : (
        <>
          <div className="results-count">
            {watchlist ? results.length : total.toLocaleString()} titles{" "}
            {watchlist ? "in your list" : language ? `on this page · Page ${page}` : `· Page ${page}`}
          </div>
          {results.length ? (
            <div className="anime-grid">
              {results.map((a) => (
                <AnimeCard key={a.id} anime={a} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>
                {watchlist && !saved.length
                  ? "Your next obsession belongs here."
                  : "No titles found"}
              </h2>
              <p>
                {watchlist && !saved.length
                  ? "Tap the bookmark on any anime to save it to your list."
                  : "Try a different search or clear your filters."}
              </p>
              <button
                className="button secondary"
                onClick={() => setParams({})}
              >
                Clear filters
              </button>
            </div>
          )}
          {!watchlist && (page > 1 || hasNext) && (
            <nav className="episode-controls" aria-label="Catalog pages">
              <button
                className="button secondary"
                disabled={page <= 1}
                onClick={() => update("page", String(page - 1))}
              >
                <BackChevron /> Previous page
              </button>
              <button
                className="button primary"
                disabled={!hasNext}
                onClick={() => update("page", String(page + 1))}
              >
                Next page <BackChevron forward />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
