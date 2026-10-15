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
│   └── src/
│       ├── App.tsx
│       ├── components/
│       └── pages/
└── README.md
```

## Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9

### Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### Run Development Servers

```bash
# Terminal 1 - Backend (port 4000)
cd server
npm run dev

# Terminal 2 - Frontend (port 5173)
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
cd client
npm run build
```

## Features

- 🎬 Browse anime with cover art and details
- 🔍 Search anime by title
- 🏷️ Filter by genre and status
- ▶️ Watch embedded video streams
- 📱 Fully responsive design
- 🎨 Dark theme with purple/indigo accents
- ⚡ Fast Vite-powered dev server

## Deployment

This project is configured for **Vercel** deployment. Connect your GitHub repo to Vercel and configure:

- **Frontend**: Set root directory to `client/`, build command `npm run build`, output `dist/`
- **Backend**: Deploy as a separate Vercel serverless function or another hosting provider

## License

MIT
