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

Ravok remains the default anime player. Akamaru maps MAL IDs to AniList IDs using
Ani.zip and resolves episode-specific Ravok iframe links from AnimeLok.
Audio/subtitles remain inside the provider's player.

If Ravok is missing or its lookup fails, Akamaru automatically resolves the anime
on Anikoto using exact catalog title aliases, then requests the chosen episode's
provider-returned iframe URL. Anikoto prefers a Sub server when available.
Ambiguous matches, missing episodes, and unsupported player hosts show a retryable
error instead of guessing another season or mounting a fabricated video URL.
The old megaplays.se MAL iframe fallback is removed.

Anikoto can return its own third-party player hosts; these are validated against
a fixed allowlist. The checked Frieren episode returned a megaplay.buzz player,
which is separate from the removed megaplays.se MAL embed route. No media URLs
are decrypted, generated, downloaded, or proxied by this adapter.

The Anikoto HTML adapter follows the public endpoint/selector behavior described
by [Yuzono's anime extensions](https://github.com/yuzono/anime-extensions), licensed
under [Apache-2.0](https://github.com/yuzono/anime-extensions/blob/master/LICENSE).

Missing episode metadata still allows a requested episode or episode 1, plus
manual entry when the list is absent. Retry Ravok can restore the primary source.
Retries also refresh Anikoto episode/server/player lookups. Cancelled navigation
does not mount an earlier episode's fallback. Mobile full-width and landscape
expansion are retained. These embeds do not report watch progress to Akamaru.

No new credentials or Vercel settings are required. Build/deploy from the root
and verify real playback from the deployed site: local resolution does not
establish upstream availability from Vercel. See [streaming notes](docs/streaming-api.md).
