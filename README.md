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

Anime episodes use Abyss iframe players resolved from AnimeLok's public episode
response. The app maps MAL IDs to AniList IDs using Ani.zip, loads real aired
episode metadata, then selects only returned player.abyssplayer.com links.
Movies Nexus, Koto, and Anikoto are not used for episode playback.

Audio choices reflect the languages actually returned for each episode. English
is preferred when available; the selected language is saved on this browser.
Previous/Next navigation loads the correct episode's player ID. Reload refreshes
the episode mapping. No video ID is generated from an anime ID or reused across
episodes, and other provider hosts are not accepted as fallbacks.

The iframe uses origin referrers and the sandbox from the supplied example:
allow-scripts allow-same-origin allow-presentation allow-forms. Provider controls
remain inside the iframe. Mobile full-width and landscape expansion remain
supported. The embedded player does not report progress to Akamaru history;
previously saved history remains readable.

No new API key is required. Vercel handles metadata/iframe-link resolution;
video loads directly from Abyss. Local checks do not establish access from
Vercel, so test episode resolution and actual playback after deployment.
See [streaming integration notes](docs/streaming-api.md).
