# Akamaru - Anime Streaming Website

A modern anime streaming platform built with **TypeScript**, **React**, **Node.js (Express)**, and **Tailwind CSS**.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Icons**: Lucide React
- **Routing**: React Router v6

## Project Structure

```
Akamaru/
├── server/          # Express API backend
│   └── src/
│       ├── server.ts
│       ├── routes/anime.ts
│       ├── data/anime.ts
│       └── types/index.ts
├── client/          # React frontend
    └── src/
        ├── App.tsx
        ├── components/
        └── pages/


```

## Getting Started

### Prerequisites
- Node.js >= 20
- npm >= 9


## Features

- 🎬 Browse anime with cover art and details
- ▶️ Watch embedded video streams
- 📱 Fully responsive design
- ⚡ Fast Vite-powered dev server

## Deployment

Deploy with **Root Directory set to the repository root** (leave it blank, not `client`) and the **Other** framework preset. The root `vercel.json` sets:

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `client/dist`
- `/api/*`: shared Express function in `api/index.js`
- Page URLs: React app with browser routing

Remove conflicting dashboard build/output overrides. Push these changes and redeploy the latest commit. Verify `/api/health` and `/api/anime` return JSON on the deployed domain. A frontend-only deployment rooted at `client` cannot include the API function.

For local development, run `npm install` then `npm run dev`. For a standalone production server, run `npm run build`, `npm test`, then `npm start` and open http://localhost:4000.

## Anime catalog (Tenrai / Jikan-compatible)

The frontend loads anime through the same-origin `/api/jikan/*` proxy. The server calls Tenrai v1 (`https://api.tenrai.org/v1`), a Jikan-compatible provider listed by the Jikan maintainer. Jikan public API shut down on October 1, 2026: https://github.com/jikan-me/jikan-rest/issues/613. The internal `/api/jikan` route name stays unchanged for compatibility. No API key or environment variables are needed. Discovery uses top anime; browsing searches the full catalog with genre/status filters, sorting, and 24-title pages. Details fetch by MyAnimeList ID, including on direct links and reloads. The existing Express demo endpoints remain available for compatibility but no longer drive the frontend catalog.

Requests are queued at least 1.05 seconds apart per browser session, identical requests are deduplicated, successful responses are cached for five minutes, and search is debounced. Network failures and upstream rate limits show a retry message. Watchlist snapshots are stored locally so saved titles remain visible across catalog pages and reloads. Legacy saved IDs are migrated to MyAnimeList IDs.

Tenrai provides metadata and available YouTube trailers, not full anime episode streams. Titles without trailers show an explicit unavailable state and link to MyAnimeList. Catalog availability depends on Tenrai and the user's network.

Run `npm run build` and `npm test` before deploying. Push the changes and redeploy Vercel to update the live site.

## License

MIT

## Cloudflare Workers deployment

Deploy from the repository root with build command `npm run build` and deploy
command `npx wrangler deploy`. The Worker name in `wrangler.jsonc` is `akamaru`
and must match the dashboard project name. Commit the Worker configuration,
entry point and dependency lockfile before retrying the Git-connected build.

The Worker uses Cloudflare's Node HTTP adapter to run the shared Express API.
Only `/api` and `/api/*` run through Express; static files in `client/dist` and
React deep links are served by Workers Static Assets with SPA fallback.
Vercel and standalone Node entry points remain separate.

After building, use `npx wrangler deploy --dry-run` to validate the bundle, or
`npx wrangler dev` to test the Workers runtime locally. Check `/api/health`,
an unknown `/api/*` route (JSON 404), and a deep link such as
`/anime/52991/episodes`. After deployment, test provider requests again:
a successful Worker deployment does not establish that Anikage permits requests
from Cloudflare or resolve an upstream HTTP 403.

## Player

Ravok is the default anime player, replacing the separate Abyss audio-language
embeds. Akamaru maps MAL IDs to AniList IDs through Ani.zip, then resolves each
episode's returned https://ravok.buzz/video/VIDEO_ID link through AnimeLok.
Audio and subtitles are selected inside Ravok, rather than through an external
Japanese/English selector. Track availability depends on the provider's episode.
The supplied Frieren episode 1 URL is used only when returned for that episode;
it is not reused for other episodes.

When Ravok is missing, mapping is unavailable, or the provider lookup fails,
playback automatically uses https://megaplays.se/stream/mal/MAL_ID/EPISODE/sub.
Retry Ravok refreshes the lookup and can restore the default source. Old Abyss
language preferences no longer affect the chosen iframe.

Empty episode metadata does not prevent playback attempts. The page defaults to
episode 1 or uses the requested episode, and allows manual episode entry when
the list is absent. Episode lists are not manufactured from a total count.

The origin referrer and supplied iframe sandbox are preserved for Ravok. Mobile
full-width and landscape expansion work with both providers. Actual playback
controls and track availability belong to the iframe provider. These sources do
not report progress to Akamaru history; saved history remains readable.

No new API key or deployment variables are required. Vercel handles metadata
and link resolution while video loads directly from the iframe provider. Build
and deploy from the repository root, then verify actual playback and subtitles
from the deployed site. See [streaming notes](docs/streaming-api.md).
