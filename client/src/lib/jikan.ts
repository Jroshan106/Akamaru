import type { Anime } from "../types";

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  synopsis?: string | null;
  images?: { jpg?: { large_image_url?: string; image_url?: string }; webp?: { large_image_url?: string; image_url?: string } };
  genres?: { mal_id: number; name: string }[];
  status?: string;
  score?: number | null;
  year?: number | null;
  aired?: { prop?: { from?: { year?: number | null } } };
  studios?: { name: string }[];
  episodes?: number | null;
  type?: string | null;
  trailer?: { youtube_id?: string | null };
  url?: string;
}
export interface JikanResult {
  data: JikanAnime[];
  pagination?: {
    current_page: number;
    has_next_page: boolean;
    items?: { total: number };
  };
}
export const legacyIds: Record<string, string> = {
  "attack-on-titan": "16498",
  "demon-slayer": "38000",
  "jujutsu-kaisen": "40748",
  "one-piece": "21",
  "my-hero-academia": "31964",
  "spy-x-family": "50265",
};
export const resolveId = (id: string) => legacyIds[id] || id;
export function normalizeAnime(a: JikanAnime): Anime {
  const trailer = a.trailer?.youtube_id;
  const image =
    a.images?.jpg?.large_image_url ||
    a.images?.webp?.large_image_url ||
    a.images?.jpg?.image_url ||
    a.images?.webp?.image_url ||
    "/placeholder.svg";
  return {
    id: String(a.mal_id),
    title: a.title_english || a.title,
    japaneseTitle: a.title_japanese || "",
    synopsis: a.synopsis || "No synopsis is available yet.",
    coverImage: image,
    bannerImage: image,
    genres: (a.genres || []).map((g) => g.name),
    status:
      a.status === "Currently Airing"
        ? "Airing"
        : a.status === "Finished Airing"
          ? "Completed"
          : "Upcoming",
    rating: a.score ?? 0,
    year: a.year || a.aired?.prop?.from?.year || 0,
    studio: a.studios?.map((s) => s.name).join(" / ") || "Studio not announced",
    episodeCount: a.episodes ?? null,
    mediaType: a.type || "Anime",
    episodes:
      trailer && /^[\w-]{11}$/.test(trailer)
        ? [
            {
              id: "trailer",
              number: 0,
              title: `${a.title_english || a.title} — Trailer`,
              thumbnail: image,
              videoUrl: `https://www.youtube.com/embed/${trailer}`,
              duration: "",
            },
          ]
        : [],
  };
}

const cache = new Map<string, { value: unknown; expires: number }>();
const pending = new Map<string, Promise<unknown>>();
let queue = Promise.resolve();
let lastStart = 0;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export class JikanError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export function jikanRequest<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached && cached.expires > Date.now())
    return Promise.resolve(cached.value as T);
  const existing = pending.get(path);
  if (existing) return existing as Promise<T>;
  const task = queue.then(async () => {
    await pause(Math.max(0, 1050 - (Date.now() - lastStart)));
    lastStart = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`/api/jikan${path}`, {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new JikanError(
          response.status === 429
            ? "The anime provider is busy. Please wait a minute, then try again."
            : response.status === 502
              ? "The anime provider is temporarily unreachable from the server. Please try again shortly."
              : "The anime catalog is temporarily unavailable. Please try again.",
          response.status,
        );
      const value = await response.json();
      if (!value || !("data" in value))
        throw new JikanError(
          "The catalog returned an unexpected response. Please try again.",
        );
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(path, { value, expires: Date.now() + 300000 });
      return value as T;
    } catch (error) {
      if (error instanceof JikanError) throw error;
      throw new JikanError(
        "Could not reach the catalog server. Please try again.",
      );
    } finally {
      clearTimeout(timeout);
    }
  });
  queue = task.then(
    () => undefined,
    () => undefined,
  );
  pending.set(path, task);
  void task.finally(() => pending.delete(path)).catch(() => {});
  return task;
}
export function searchPath(
  params: URLSearchParams,
  genres: { mal_id: number; name: string }[],
) {
  const query = new URLSearchParams({
    sfw: "true",
    limit: "24",
    page: String(Math.max(1, Math.floor(Number(params.get("page")) || 1))),
  });
  const search = params.get("search")?.trim();
  if (search) query.set("q", search);
  const genre = genres.find((g) => g.name === params.get("genre"));
  if (genre) query.set("genres", String(genre.mal_id));
  const status: Record<string, string> = {
    Airing: "airing",
    Completed: "complete",
    Upcoming: "upcoming",
  };
  if (status[params.get("status") || ""])
    query.set("status", status[params.get("status")!]);
  const sort = params.get("sort");
  query.set(
    "order_by",
    sort === "title" ? "title" : sort === "year" ? "start_date" : "score",
  );
  query.set("sort", sort === "title" ? "asc" : "desc");
  return `/anime?${query}`;
}
