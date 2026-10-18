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

## Animiru api

The Akamaru cinema controls cover the provider frame and disable its pointer and tab input. Play/pause, seeking and mute use MegaPlay's existing postMessage bridge, with origin and source validation; fullscreen is handled by Akamaru. This prevents direct player-click ad handlers from receiving user clicks. The provider iframe still runs third-party scripts, so this is not a blanket ad blocker or a guarantee against provider-inserted advertising. Unsupported hosts display a server-selection message instead of an interactive third-party player. Caption and quality menus are not exposed by the supported bridge.

Open an anime's detail page and choose **Watch episodes**. Select the matching title/season, then an episode and Sub/Dub server. The separate `/api/animiru` adapter loads public listings from `anikoto` and embeds the provider-returned player. It does not download or proxy video, generate media access tokens, or bypass player restrictions. Unknown player hosts are rejected; an external episode link remains available. Third-party availability and playback can change, and local verification does not guarantee access from Vercel.

The request flow and HTML selectors were informed by [Yūzōnō's extension] distributed under [Apache-2.0](https://github.com/yuzono/anime-extensions/blob/master/LICENSE). The web adapter is independently implemented; no Android extractor, decryption or token-generation code is included. No API key is required. Deploy the repository root so the Express API is included.

The proxy allows only anime search, top anime, genres, and numeric anime details. It caches successful responses for five minutes, deduplicates concurrent requests, spaces upstream calls, and returns non-cacheable JSON errors on rate limits/timeouts. This requires deploying the root Vercel API function alongside the frontend. After deployment, check /api/jikan/top/anime?limit=1 returns JSON. A 502 means Vercel could not reach Tenrai; a 404 means the function/routing was not deployed. This change cannot resolve an outage at the upstream provider itself.

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

The episode page defaults to **Koto · Custom player**. The server searches Anikage's catalog and the client selects only an exact MyAnimeList ID match automatically. If no exact match exists, the viewer chooses the title/season. Actual episode lists, Sub/Dub sources and skip timings come from the Koto service. No pasted watch link is required. **Anikoto · Existing player** remains an explicit fallback.

This is an integration with Anikage's undocumented Koto source service, not an independent extractor or a copy of its backend. Video is played by HTML video and hls.js inside Akamaru, with captions, available manifest qualities, speed (0.5–3x), ten-second seeking, intro skipping, fullscreen and next-episode autoplay. Quality choices depend on the stream; an episode with only 1080p offers Auto and 1080p. Autoplay can require a user gesture under browser policy.

The existing same-origin media gateway forwards requests to the fixed `og.bakayaro.live` service with its provider request headers. Master/variant playlists, segment and key URLs, and subtitles stay on the gateway; remote redirects and foreign playlist resource hosts are rejected. Metadata is briefly cached and deduplicated. Temporary media URLs are not saved to disk. The upstream service still controls availability and may change its API or request requirements.

The earlier direct-browser experiment was rejected by the media service for Akamaru's domain. The gateway changes that request path; verify the deployed API and playback after deployment rather than assuming a local test proves Vercel access. Media segments consume hosting bandwidth and function requests; production response-size, execution-time and usage limits still apply. No deployment is performed by a local build.
