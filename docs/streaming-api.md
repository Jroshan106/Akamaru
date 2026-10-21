# Ravok-first playback with Anikoto fallback

Ravok is preferred. Anikoto replaces the failed megaplays.se MAL embed fallback.
Ravok resolution still uses verified AniList IDs and episode-specific AnimeLok
responses, accepting only https://ravok.buzz/video/VIDEO_ID links.

## Anikoto resolution

1. The client calls /api/anikoto/resolve/MAL_ID after Ravok fails, returns no
   player, or cannot be attempted without an AniList mapping.
2. The server gets catalog title aliases from Tenrai, searches Anikoto's public
   listings, and accepts only one exact normalized alias match. Ambiguous results
   are refused; the client also verifies that the resolved MAL ID matches.
3. /api/anikoto/SLUG/episodes/NUMBER/players reads the real episode list, server
   identifiers, and selected provider-returned embed URL. Sub is preferred when
   listed; the returned audio type is displayed accurately.
4. HTTPS embeds are permitted only on megaplay.buzz, megaplay.cc, and
   mewcdn.online, without credentials or explicit ports. Unknown hosts show an
   error. No guessed embed template or megaplays.se request remains.

Anikoto chooses its own underlying video hosts. A live local Frieren episode 1
check returned a Sub player on megaplay.buzz, which is a different hostname and
provider-resolved URL from the removed megaplays.se MAL route. This is iframe
integration, not stream extraction, decryption, or a media proxy.

The client labels Anikoto only after a valid player is resolved. Missing titles,
missing episodes, malformed responses, blocked hosts, and unavailable providers
show a retry message instead of a blank/invalid iframe. Retry refreshes episode,
server, and embed lookup responses. Retry Ravok can recover to the preferred
source. Abort checks prevent mounting a fallback after leaving an episode.

## Metadata and UI

The existing /api/nexus/MAL_ID route supplies Ani.zip ID and episode metadata;
it does not call Movies Nexus. Missing metadata permits a requested episode or
episode 1 and manual entry. Anikoto can resolve from the MAL catalog identity
without an AniList mapping. Episode navigation remains in Akamaru.

Ravok retains the supplied iframe sandbox and origin referrer. The Anikoto
fallback uses the provider's native player with autoplay/fullscreen permissions.
Mobile full-width and landscape expansion remain supported. Provider controls,
track availability, and video availability belong to the provider. These embeds
do not expose progress events for Akamaru history.

## Checks and deployment

Production build, TypeScript checks, and all 42 tests passed. Browser integration
checks with simulated provider frames covered Ravok priority, Anikoto fallback
for the exact episode, recovery to Ravok, fallback error/retry, mobile sizing,
and absence of the removed megaplays.se URL.

Live local Anikoto catalog matching and Frieren episode 1 resolution passed;
continuous playback and access from Vercel are not established by that check.
No new environment variable or API key is required. Deploy from the repository
root using the existing configuration, then verify actual video playback on the
deployed site. No deployment was performed.
