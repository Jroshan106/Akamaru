# Ravok-first playback with MegaPlays fallback

Ravok replaces the previous Abyss language-specific players. The provider's own
audio and subtitle controls are used. Old saved Abyss language preferences no
longer select an iframe; no guarantee is made about available subtitle tracks.

## Resolution

1. /api/nexus/MAL_ID obtains ID and episode metadata from Ani.zip. The internal
   name is retained for compatibility and does not call Movies Nexus.
2. /api/animelok/ANILIST_ID/EPISODE requests AnimeLok's fixed public episode URL
   and validates the returned anime ID and episode number.
3. Only https://ravok.buzz/video/VIDEO_ID iframe URLs are accepted as the preferred
   source. Direct Abyss tracks and other server hosts are ignored. No video URL
   extraction, encrypted-payload decoding, or video proxying is performed.
4. Missing Ravok links, invalid provider responses, lookup failures, or missing
   AniList mappings automatically use
   https://megaplays.se/stream/mal/MAL_ID/EPISODE/sub.
5. Retry Ravok requests a fresh mapping and can recover to the preferred source.
   Episode changes resolve the next episode independently. Cancelled navigation
   does not mount an old episode's fallback.

The supplied Frieren episode 1 Ravok URL was confirmed in AnimeLok's response.
Its video ID is not generated or hard-coded into the episode page. Different
episodes use their own returned link. Only the provider controls available
inside Ravok can choose its audio and subtitle tracks.

## Metadata and iframe behavior

Empty or unavailable episode metadata still permits an explicit episode or
episode 1. A manual episode-number field is available when the list is missing.
A valid numeric route can attempt a newly released episode absent from a stale
list. Invalid IDs and non-positive/non-integer episode values are rejected.

Ravok preserves the user's origin referrer policy and supplied sandbox:
allow-scripts allow-same-origin allow-presentation allow-forms. Autoplay,
encrypted media, fullscreen, and picture-in-picture permissions remain enabled.
Mobile full-width and landscape expansion work with both providers. These
cross-origin embeds do not expose watch progress to Akamaru history.

Fallback responds to source lookup availability. A loaded cross-origin iframe's
internal video failure cannot reliably trigger it without a documented event
bridge. No such event or undocumented subtitle control is assumed.

## Verification and deployment

Production build, TypeScript checks, and all 34 tests passed. Browser integration
checks with simulated iframe contents cover the exact supplied Ravok URL,
episode-specific links, old preference handling, iframe permissions, automatic
MegaPlays fallback, recovery to Ravok, and mobile fullscreen.

The supplied Ravok iframe returned HTTP 200 during the live check. Japanese
subtitle availability and uninterrupted video playback were not independently
verified. Check these after deployment; a loaded page does not guarantee tracks.
No new API key or Vercel setting is required. No deployment was performed.
