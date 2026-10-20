# Anime playback through Abyss

Akamaru uses Abyss players returned by AnimeLok's public episode endpoint.
Movies Nexus, Koto/Anikage, and Anikoto are not used for episode playback.
Old source preferences are ignored. Retired Koto/Anikoto API routes return JSON
404s, and the interface has no alternative-server selector or fallback.

## Resolution flow

1. /api/nexus/MAL_ID supplies shared public ID and aired-episode metadata from
   https://api.ani.zip/mappings?mal_id=MAL_ID. This endpoint retains its earlier
   internal name but makes no Movies Nexus requests.
2. /api/animelok/ANILIST_ID/EPISODE fetches the fixed upstream URL
   https://animelok.cc/api/anilist/ANILIST_ID/EPISODE.
3. The adapter verifies the returned AniList ID and episode number. It accepts
   only language-labelled iframe links on https://player.abyssplayer.com with a
   single video-ID path. Credentials, ports, queries, fragments, and foreign
   hosts are rejected. No encrypted payloads are decoded or video URLs extracted.
4. The browser embeds the selected language's original URL. English is preferred
   if available, otherwise Japanese or the first returned language. A saved
   language preference is used when available for the next episode.

The supplied Frieren example E-aqhQkoAa is labelled Tamil by AnimeLok. Episode 1
has separate English and Japanese player IDs. Episode 2 returns different video
IDs for those languages; these are resolved dynamically rather than hard-coded.
Cyberpunk episode 1 returned no Abyss tracks during the check. Such episodes
show an unavailable message with Retry; another host is not silently substituted.

## Iframe behavior

The player preserves the supplied origin referrer policy and sandbox permissions:
allow-scripts allow-same-origin allow-presentation allow-forms. Autoplay,
encrypted media, fullscreen, and picture-in-picture permissions are enabled.

Actual player controls belong to Abyss. Akamaru handles audio-language selection,
episode navigation, reload, mobile width, and landscape expansion. It does not
assume undocumented external control commands or playback-progress events, and
does not fabricate watch history. Previously saved history remains readable.

Successful player mappings are cached for 60 seconds and concurrent requests are
deduplicated. Reload/Retry requests a fresh mapping; missing streams and failed
requests are not cached as successes. The gateway never proxies video bytes.

## Deployment and verification

No new API key or environment variable is required. Build and deploy from the
repository root with the existing configuration. Vercel must be able to reach
Ani.zip and AnimeLok; browsers load the Abyss iframe directly. Provider outages
or access restrictions can still prevent playback after deployment.

Checks cover language mapping, exact episode matching, host restrictions,
metadata cache/refresh behavior, absent streams, upstream errors, default English,
the supplied Tamil embed, episode-2 language persistence, iframe permissions,
phone width, and landscape expansion. Live provider availability must be checked
separately from integration tests using simulated iframe contents.

The production build and all 28 automated tests passed. The live English iframe
loaded its controls and approximately 26 minutes of video metadata, but its
overlay intercepted the automated play interaction. Continuous playback was not
verified; test it manually and again after deployment.
