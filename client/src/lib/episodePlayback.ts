export type PlaybackEpisode = { number: string; title: string };
export type PlaybackProvider = 'abyss' | 'anikoto';
export type EpisodePlayback = { provider: PlaybackProvider; players: { language: string; url: string }[]; episodes?: PlaybackEpisode[]; languages?: ('sub' | 'dub')[]; audio?: 'sub' | 'dub'; fallbackFrom?: PlaybackProvider };

export function allowedAnikotoPlayer(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['megaplay.buzz', 'megaplay.cc', 'mewcdn.online'].includes(url.hostname);
  } catch { return false; }
}

// Resolve actual episode embeds and fall back to the other server when lookup fails.
export async function resolveEpisodePlayback(
  { malId, anilistId, episode, refresh = false, provider = 'abyss', language }: {
    malId: string; anilistId?: number; episode: string; refresh?: boolean;
    provider?: PlaybackProvider; language?: 'sub' | 'dub';
  },
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<EpisodePlayback> {
  if (!/^[1-9]\d{0,8}$/.test(malId) || !/^[1-9]\d{0,4}$/.test(episode)) throw new Error('Choose a valid anime and episode number.');
  signal.throwIfAborted();
  async function read(path: string) {
    let response: Response;
    let data;
    try {
      response = await fetcher(path, { signal });
      data = await response.json();
    } catch { signal.throwIfAborted(); throw new Error('The episode server is temporarily unavailable. Please retry.'); }
    signal.throwIfAborted();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The episode server returned an unexpected response.');
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'This episode is unavailable on the selected server.');
    return data;
  }
  async function abyss(): Promise<EpisodePlayback> {
    if (!Number.isSafeInteger(anilistId) || Number(anilistId) <= 0) throw new Error('Abyss has no mapping for this anime yet.');
    const data = await read(`/api/animelok/${anilistId}/${episode}${refresh ? '?refresh=1' : ''}`);
    const players = Array.isArray(data.players) ? data.players.filter((p: { language?: unknown; url?: unknown }) =>
      typeof p?.language === 'string' && typeof p?.url === 'string' && /^https:\/\/player\.abyssplayer\.com\/[\w-]{1,128}$/.test(p.url)) : [];
    if (!players.length) throw new Error('No Abyss player is available for this episode.');
    return { provider: 'abyss', players };
  }
  async function anikoto(): Promise<EpisodePlayback> {
    const match = await read(`/api/anikoto/resolve/${malId}`);
    const slug = match.item?.slug;
    if (match.malId !== Number(malId) || typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,180}$/.test(slug)) throw new Error('Anikoto could not verify the matching anime.');
    const query = new URLSearchParams();
    if (refresh) query.set('refresh', '1');
    if (language) query.set('language', language);
    const player = await read(`/api/anikoto/${slug}/episodes/${episode}/players${query.size ? `?${query}` : ''}`);
    if (!allowedAnikotoPlayer(player.url)) throw new Error(player.message || 'No compatible Anikoto player is available for this episode.');
    const episodes: PlaybackEpisode[] = Array.isArray(player.episodes) ? [...new Map<string, PlaybackEpisode>(player.episodes
      .filter((e: PlaybackEpisode) => e && typeof e.number === 'string' && /^[1-9]\d{0,4}$/.test(e.number))
      .map((e: PlaybackEpisode) => [e.number, { number: e.number, title: typeof e.title === 'string' && e.title.trim() ? e.title.trim() : `Episode ${e.number}` }] as const))
      .values()].sort((a, b) => Number(a.number) - Number(b.number)) : [];
    const audio = player.language === 'dub' ? 'dub' : 'sub';
    const languages: ('sub' | 'dub')[] = Array.isArray(player.languages) ? player.languages.filter((l: unknown) => l === 'sub' || l === 'dub') : [audio];
    return { provider: 'anikoto', episodes, languages, audio, players: [{ language: audio === 'dub' ? 'English · Dub' : 'Japanese · Sub', url: player.url }] };
  }
  const sources = { abyss, anikoto };
  try { return await sources[provider](); }
  catch (first) {
    signal.throwIfAborted();
    const other = provider === 'abyss' ? 'anikoto' : 'abyss';
    try { return { ...await sources[other](), fallbackFrom: provider }; }
    catch (second) {
      signal.throwIfAborted();
      throw new Error(`${first instanceof Error ? first.message : 'Selected server unavailable'} ${second instanceof Error ? second.message : 'Alternative server unavailable'}`);
    }
  }
}
