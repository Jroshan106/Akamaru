import { Link, useParams } from "react-router-dom";
import { useCatalog } from "../lib/catalog";
import { CatalogState, NotFound } from "../components/CatalogUI";
export default function WatchPage() {
  const { animeId, episodeId } = useParams();
  const { anime, loading, error } = useCatalog();
  if (loading || error) return <CatalogState />;
  const item = anime.find((a) => a.id === animeId);
  const episode = item?.episodes.find((e) => e.id === episodeId);
  if (!item || !episode) return <NotFound />;
  const index = item.episodes.indexOf(episode);
  const allowed = /^https:\/\/www\.youtube\.com\/embed\/[\w-]+$/.test(
    episode.videoUrl,
  );
  return (
    <div className="page watch-page">
      <Link className="back-link" to={`/anime/${item.id}`}>
        ← {item.title}
      </Link>
      <div className="watch-layout">
        <section>
          <div className="video-player">
            {allowed ? (
              <iframe
                key={episode.id}
                src={episode.videoUrl}
                title={`${item.title} — ${episode.title} preview`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <p>This video is unavailable.</p>
            )}
          </div>
          <div className="watch-title">
            <div>
              <span className="eyebrow">
                VIDEO PREVIEW · EPISODE {episode.number}
              </span>
              <h1>{episode.title}</h1>
            </div>
          </div>
          <p className="muted">
            This demo uses YouTube previews. Availability depends on the
            uploader and your region.
          </p>
          {allowed && (
            <a
              className="text-link"
              href={episode.videoUrl.replace("/embed/", "/watch?v=")}
              target="_blank"
              rel="noreferrer"
            >
              Video not playing? Open on YouTube ↗
            </a>
          )}
          <div className="episode-controls">
            {index > 0 ? (
              <Link
                className="button secondary"
                to={`/watch/${item.id}/${item.episodes[index - 1].id}`}
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {index < item.episodes.length - 1 && (
              <Link
                className="button primary"
                to={`/watch/${item.id}/${item.episodes[index + 1].id}`}
              >
                Next preview →
              </Link>
            )}
          </div>
        </section>
        <aside>
          <h2>Episode guide</h2>
          <p className="muted">{item.episodes.length} previews</p>
          {item.episodes.map((e) => (
            <Link
              aria-current={e.id === episode.id ? "page" : undefined}
              className={`episode-row ${e.id === episode.id ? "selected" : ""}`}
              key={e.id}
              to={`/watch/${item.id}/${e.id}`}
            >
              <span className="episode-number">
                {String(e.number).padStart(2, "0")}
              </span>
              <div>
                <strong>{e.title}</strong>
                <span>
                  {e.id === episode.id ? "Now selected" : "Watch preview"}
                </span>
              </div>
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}
