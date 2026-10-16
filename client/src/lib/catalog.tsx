import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { Anime } from "../types";

type Catalog = {
  anime: Anime[];
  loading: boolean;
  error: string;
  retry: () => void;
  saved: string[];
  toggle: (id: string) => void;
};
const Context = createContext<Catalog>(null!);
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [anime, setAnime] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem("akamaru-watchlist") || "[]",
      );
      return Array.isArray(value)
        ? value.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/anime", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setAnime)
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "We couldn’t load the catalog. Check that the API is running and try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const toggle = (id: string) =>
    setSaved((previous) => {
      const next = previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id];
      try {
        localStorage.setItem("akamaru-watchlist", JSON.stringify(next));
      } catch {
        /* Still usable for this session. */
      }
      return next;
    });
  return (
    <Context.Provider
      value={{
        anime,
        loading,
        error,
        retry: () => setAttempt((x) => x + 1),
        saved,
        toggle,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useCatalog = () => useContext(Context);
