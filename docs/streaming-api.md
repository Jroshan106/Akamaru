# Streaming API and player controls

Akamaru uses **Anikage's Koto source API** for its full-control player. This was
already partly integrated; the episode page previously defaulted to the basic
embedded source. New sessions now default to **Akamaru · Full controls**, while
saved source preferences remain respected.

## Evaluation on October 21, 2026

| Service | Findings | Decision |
| --- | --- | --- |
| [Anikage](https://anikage.cc/) / Koto | Live catalog, episode sources, 1080p HLS master, and WebVTT subtitles responded successfully. Actual playback and custom controls worked through Akamaru's local API. | Use the existing adapter as the default full-control option. |
| [Aniweeb API](https://api.aniweeb.net/docs) | Episode and server listings worked, but the documented playback interface supplies iframe URLs. Its docs do not specify an external control bridge for subtitles, quality, or speed. | Does not meet this request for Akamaru's own controls. |
| [AnimePahe API](https://myapi-psi-wheat.vercel.app/) | Documents a custom HLS interface. Its health endpoint responded, but title searches timed out during evaluation. | Do not add an unverified playback dependency. |

These are local checks of current availability, not guarantees of service
uptime, catalog coverage, or access from a hosting platform. Koto's interface is
undocumented and may change. No upstream extractor or token decryption was added.

## Request flow

1. `/api/anikage/search?q=TITLE` finds titles. Only an exact MAL ID match is selected.
2. `/api/anikage/SLUG/episodes` returns real episode numbers and names.
3. `/api/anikage/SLUG/EPISODE?lang=sub` (or `dub`) requests a current source.
4. The adapter returns a local `/api/anikage/media/m3u8/TOKEN` URL, local
   WebVTT track URLs, and intro/outro timings where supplied.
5. CinemaPlayer plays HLS through hls.js or native HLS. The existing gateway
   handles the fixed media service; client input cannot choose an arbitrary host.

Direct video exposes play/pause, seeking, mute, speed, captions, available HLS
qualities, fullscreen, and next-episode controls. Quality selection cannot add
resolutions missing from the source; the checked Frieren episode offered Auto
and 1080p. Native HLS browsers may manage quality automatically.

Fatal playback errors now show an episode retry and the Anikoto fallback. Retry
loads a fresh source instead of reusing an expired stream URL. Subtitle selection
uses the current preference when additional tracks arrive, including Off.

## Verification

- Production client build and client/server TypeScript checks passed.
- All 32 automated tests passed, including local URL normalization, source
  response mapping, playlist rewriting, and rejected media hosts/resource paths.
- Live Chrome playback of Frieren episode 1 passed play, pause, ten-second
  forward seek, 1.5x speed, 1080p selection, subtitles Off, and English subtitles.
- The provider returned nine subtitle tracks and a duration of about 26 minutes.

Changes are not deployed. After deployment, check search, source resolution,
playlist/segment loading, subtitles, and actual playback again. Hosting bandwidth
and request limits apply because media is served through the existing gateway.
