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
- 🔍 Search anime by title
- 🏷️ Filter by genre and status
- ▶️ Watch embedded video streams
- 📱 Fully responsive design
- 🎨 Dark theme with purple/indigo accents
- ⚡ Fast Vite-powered dev server

## Deployment

Build and run on a Node.js host using the production commands below. Vercel serverless deployment is not configured.

## License

MIT

## Run locally

Install Node.js 20 or newer, then run these commands from the repository root:

```sh
npm install
npm run dev
```

Open http://localhost:5173. The development command starts both Vite and the Express API (port 4000).

## Production build

```sh
npm run build
npm test
npm start
```

Open http://localhost:4000. Express serves the built frontend, API, and browser deep links from a single origin. Deploy this application to a host supporting a persistent Node.js process. The existing scaffold does not include Vercel serverless configuration.

Optional server environment settings: `PORT` (default `4000`) and `CLIENT_URL` (default `http://localhost:5173`).

## Implemented experience

- Responsive discovery page with selectable featured titles and genre shortcuts.
- Search, genre/status filters, rating/year/title sorting, and empty/error/loading states.
- Detail pages, episode guides, embedded YouTube previews, and previous/next navigation.
- Browser-local watchlist; no account or backend persistence required.
- Unknown-page handling and production deep-link support.

The six-title catalog is demo data. Existing YouTube URLs are external previews, not verified full episodes; playback can be unavailable or restricted by the uploader. Replace catalog video URLs with authorized media before offering full-episode streaming. Catalog ratings and statuses are sample metadata, not live data.

`Start-Akamaru.ps1` also starts development on this PC and can use the temporary Node.js runtime prepared during setup.
