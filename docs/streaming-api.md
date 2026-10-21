# Abyss and Anikoto playback

Abyss is the default multi-language server. `/api/animelok/ANILIST_ID/EPISODE`
validates the response identity and returns only real HTTPS
`player.abyssplayer.com/VIDEO_ID` links. Language choices come from the episode's
track list; no static sample is reused for other episodes. Ravok is no longer used.

Anikoto supports Japanese Sub and English Dub. `/api/anikoto/resolve/MAL_ID`
uses exact catalog aliases, refusing ambiguous seasons. The player's endpoint
`/api/anikoto/SLUG/episodes/NUMBER/players?language=sub|dub` selects the requested
audio and returns available languages, the actual episode list, and a validated
provider-returned embed. Missing audio returns an error rather than silently
playing a different language. HTTPS embeds are limited to megaplay.buzz,
megaplay.cc, and mewcdn.online. The retired megaplays.se template is not used.
No media extraction, decryption, downloading, or proxying occurs.

Server buttons switch providers. Abyss language buttons switch returned tracks;
Anikoto buttons resolve Sub or Dub. The selected server is tried first, then the
other if lookup fails. The UI identifies fallback and offers a retry of the
preferred server. Aborted requests cannot mount stale players. Cross-origin
iframe playback errors cannot be reliably detected; users can switch servers
or retry if the video fails later.

`/api/nexus/MAL_ID` still supplies Ani.zip mapping/metadata, without calling
Movies Nexus. Missing metadata uses Anikoto's real episode list in the same
sidebar with titles and Previous/Next navigation. Manual entry remains only
when neither list is available. Mobile fullscreen behavior remains.

Abyss uses `allow-scripts allow-same-origin allow-presentation allow-forms`
and origin referrers. Popups and top navigation are excluded. Its compatibility
button removes sandboxing for that embed if needed and can restore protection.
Anikoto is unsandboxed because its live player explicitly refuses sandboxed
iframes. This cannot remove in-video or in-frame ads. Provider players do not
expose progress events for Akamaru history.

Live checks: Frieren episode 1 returned five Abyss languages, and the sandboxed
Abyss page created its video player. Anikoto returned both Sub and Dub options;
its sandboxed page reported that sandboxing was forbidden. These checks do not
establish continuous playback or availability from a Vercel deployment.

No new credentials or deployment settings are required. Deploy from the root
with the existing Vercel configuration and verify playback from that deployment;
local resolution does not establish provider availability from Vercel.

The Anikoto HTML adapter follows public selectors/endpoints described by
[Yuzono's anime extensions](https://github.com/yuzono/anime-extensions), licensed
under [Apache-2.0](https://github.com/yuzono/anime-extensions/blob/master/LICENSE).
