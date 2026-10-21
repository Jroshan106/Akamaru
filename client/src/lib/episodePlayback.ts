export type PlaybackEpisode = { number: string; title: string };
export type EpisodePlayback = { provider: 'ravok' | 'anikoto'; players: { language: string; url: string }[]; episodes?: PlaybackEpisode[] };

export function allowedAnikotoPlayer(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['megaplay.buzz', 'megaplay.cc', 'mewcdn.online'].includes(url.hostname);
  } catch { return false; }
}

// Ravok stays first. Anikoto's catalog resolves a verified title/episode fallback;
// player URLs are always returned by the provider, never generated from MAL IDs.
export async function resolveEpisodePlayback(
  { malId, anilistId, episode, refresh = false }: { malId: string; anilistId?: number; episode: string; refresh?: boolean },
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<EpisodePlayback> {
  if (!/^[1-9]\d{0,8}$/.test(malId) || !/^[1-9]\d{0,4}$/.test(episode)) throw new Error('Choose a valid anime and episode number.');
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
  async function readAnikoto(path: string) {
    let response: Response;
    let data;
    try {
      response = await fetcher(`/api/anikoto${path}`, { signal });
      data = await response.json();
    } catch { signal.throwIfAborted(); throw new Error('Anikoto is temporarily unavailable. Please retry later.'); }
    signal.throwIfAborted();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Anikoto returned an unexpected response. Please retry later.');
    if (!response.ok) throw new Error(data.error || 'Anikoto could not load this episode. Please retry later.');
    return data;
  }
  const match = await readAnikoto(`/resolve/${malId}`);
  const slug = match.item?.slug;
  if (match.malId !== Number(malId) || typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,180}$/.test(slug)) throw new Error('Anikoto could not verify the matching anime.');
  const player = await readAnikoto(`/${slug}/episodes/${episode}/players${refresh ? '?refresh=1' : ''}`);
  if (!allowedAnikotoPlayer(player.url)) throw new Error(player.message || 'No compatible Anikoto player is available for this episode.');
  const episodes: PlaybackEpisode[] = Array.isArray(player.episodes) ? [...new Map<string, PlaybackEpisode>(player.episodes
    .filter((e: PlaybackEpisode) => e && typeof e.number === 'string' && /^[1-9]\d{0,4}$/.test(e.number))
    .map((e: PlaybackEpisode) => [e.number, { number: e.number, title: typeof e.title === 'string' && e.title.trim() ? e.title.trim() : `Episode ${e.number}` }] as const))
    .values()].sort((a, b) => Number(a.number) - Number(b.number)) : [];
  return { provider: 'anikoto', episodes, players: [{ language: player.language === 'dub' ? 'English · Dub' : player.language === 'sub' ? 'Japanese · Sub' : 'Provider audio', url: player.url }] };
}
