import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
  useCallback,
} from "react";
import { useLocation } from "react-router-dom";
import type { Anime } from "../types";
import {
  jikanRequest,
  normalizeAnime,
  searchPath,
  resolveId,
  JikanError,
  type JikanAnime,
  type JikanResult,
} from "./jikan";

type Genre = { mal_id: number; name: string };
type Catalog = {
  anime: Anime[];
  loading: boolean;
  error: string;
  retry: () => void;
  saved: string[];
  toggle: (id: string) => void;
  genres: Genre[];
  hasNext: boolean;
  total: number;
  remember: (items: Anime[]) => void;
};
const Context = createContext<Catalog>(null!);
function readSaved(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("akamaru-watchlist") || "[]",
    );
    return Array.isArray(value)
      ? [
          ...new Set(
            value
              .filter((id): id is string => typeof id === "string")
              .map(resolveId),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [anime, setAnime] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(readSaved);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);
  const known = useRef(new Map<string, Anime>());
  const remember = useCallback((items: Anime[]) => { items.forEach(item => known.current.set(item.id, item)); }, []);
  const { pathname, search } = useLocation();
  const watchlistKey = pathname === "/watchlist" ? saved.join(",") : "";
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setHasNext(false);
    async function load() {
      try {
        let items: Anime[] = [];
        let count = 0;
        let next = false;
        const detailId = pathname.match(/^\/(?:anime|watch)\/([^/]+)/)?.[1];
        if (pathname === '/history') {
          // Watch history does not depend on the online catalog.
          items = [];
        } else if (detailId) {
          const id = resolveId(detailId);
          if (/^\d+$/.test(id)) {
            const response = await jikanRequest<{ data: JikanAnime }>(
              `/anime/${id}`,
            );
            items = [normalizeAnime(response.data)];
          } else {
            const cleanQuery = decodeURIComponent(id).replace(/[-_]+/g, ' ').trim();
            if (cleanQuery) {
              try {
                const response = await jikanRequest<JikanResult>(
                  `/anime?q=${encodeURIComponent(cleanQuery)}&limit=1`,
                );
                if (response.data && response.data.length > 0) {
                  items = [normalizeAnime(response.data[0])];
                }
              } catch {
                /* Ignore and fallback gracefully */
              }
            }
          }
        } else if (pathname === "/watchlist") {
          const ids = watchlistKey.split(",").filter(Boolean);
          for (const id of ids) {
            if (cancelled) return;
            let item = known.current.get(id);
            if (!item) {
              try {
                const stored = JSON.parse(
                  localStorage.getItem(`akamaru-title-${id}`) || "null",
                );
                if (stored?.id === id && Array.isArray(stored.episodes))
                  item = stored;
              } catch {
                /* Storage is optional. */
              }
            }
            if (!item && /^\d+$/.test(id)) {
              try {
                item = normalizeAnime(
                  (await jikanRequest<{ data: JikanAnime }>(`/anime/${id}`))
                    .data,
                );
              } catch (e) {
                if (!(e instanceof JikanError && e.status === 404)) throw e;
              }
            }
            if (item) items.push(item);
          }
          count = items.length;
        } else {
          let path = "/top/anime?sfw=true&limit=24";
          if (pathname === "/browse") {
            const response = await jikanRequest<{ data: Genre[] }>(
              "/genres/anime",
            );
            if (cancelled) return;
            setGenres(response.data);
            path = searchPath(new URLSearchParams(search), response.data);
          }
          const response = await jikanRequest<JikanResult>(path);
          items = [
            ...new Map(
              response.data.map((a) => [a.mal_id, normalizeAnime(a)]),
            ).values(),
          ];
          next = response.pagination?.has_next_page || false;
          count = response.pagination?.items?.total ?? items.length;
        }
        if (cancelled) return;
        items.forEach((a) => {
          known.current.set(a.id, a);
          if (detailId) known.current.set(detailId.toLowerCase(), a);
        });
        setAnime(items);
        setTotal(count);
        setHasNext(next);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof JikanError && e.status === 404) setAnime([]);
        else
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load the catalog. Please try again.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const timer = setTimeout(load, pathname === "/browse" ? 400 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pathname, search, attempt, watchlistKey]);
  const toggle = (id: string) => {
    const next = saved.includes(id)
      ? saved.filter((item) => item !== id)
      : [...saved, id];
    try {
      localStorage.setItem("akamaru-watchlist", JSON.stringify(next));
      const item = known.current.get(id);
      if (item && next.includes(id))
        localStorage.setItem(`akamaru-title-${id}`, JSON.stringify(item));
      else localStorage.removeItem(`akamaru-title-${id}`);
    } catch {
      /* Watchlist remains usable for this session. */
    }
    setSaved(next);
  };
  return (
    <Context.Provider
      value={{
        anime,
        loading,
        error,
        retry: () => setAttempt((x) => x + 1),
        saved,
        toggle,
        genres,
        hasNext,
        total,
        remember,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useCatalog = () => useContext(Context);
