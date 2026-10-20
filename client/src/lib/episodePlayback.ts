export type EpisodePlayback = { provider: 'ravok' | 'megaplays'; players: { language: string; url: string }[] };

export function megaPlaysUrl(malId: string, episode: string): string {
  if (!/^[1-9]\d{0,8}$/.test(malId) || !/^[1-9]\d{0,4}$/.test(episode)) throw new Error('Choose a valid anime and episode number.');
  return `https://megaplays.se/stream/mal/${malId}/${episode}/sub`;
}

// Ravok stays first. Missing mappings, missing streams, and provider errors use
// the user-supplied MAL embed format; cancelled navigation must not mount it.
export async function resolveEpisodePlayback(
  { malId, anilistId, episode, refresh = false }: { malId: string; anilistId?: number; episode: string; refresh?: boolean },
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<EpisodePlayback> {
  const fallback = megaPlaysUrl(malId, episode);
  signal.throwIfAborted();
  if (Number.isSafeInteger(anilistId) && Number(anilistId) > 0) {
    try {
      const response = await fetcher(`/api/animelok/${anilistId}/${episode}${refresh ? '?refresh=1' : ''}`, { signal });
      const data = await response.json();
      signal.throwIfAborted();
      const players = Array.isArray(data.players) ? data.players.filter((p: { language?: unknown; url?: unknown }) =>
        typeof p?.language === 'string' && typeof p?.url === 'string' && /^https:\/\/ravok\.buzz\/video\/[\w-]{1,128}$/.test(p.url)) : [];
      if (response.ok && players.length) return { provider: 'ravok', players };
    } catch { signal.throwIfAborted(); }
  }
  signal.throwIfAborted();
  return { provider: 'megaplays', players: [{ language: 'Japanese · Sub', url: fallback }] };
}
