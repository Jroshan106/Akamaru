import { Router, Request, Response } from 'express';
import { animeList } from '../data/anime';

const router = Router();

// GET /api/anime - Get all anime (with optional search & genre filter)
router.get('/', (req: Request, res: Response) => {
  let results = [...animeList];

  const search = req.query.search as string | undefined;
  const genre = req.query.genre as string | undefined;
  const status = req.query.status as string | undefined;

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.japaneseTitle.toLowerCase().includes(q) ||
        a.synopsis.toLowerCase().includes(q)
    );
  }

  if (genre) {
    results = results.filter((a) =>
      a.genres.some((g) => g.toLowerCase() === genre.toLowerCase())
    );
  }

  if (status) {
    results = results.filter(
      (a) => a.status.toLowerCase() === status.toLowerCase()
    );
  }

  res.json(results);
});

// GET /api/anime/genres - Get all unique genres
router.get('/genres', (_req: Request, res: Response) => {
  const genres = [...new Set(animeList.flatMap((a) => a.genres))].sort();
  res.json(genres);
});

// GET /api/anime/:id - Get a single anime by ID
router.get('/:id', (req: Request, res: Response) => {
  const anime = animeList.find((a) => a.id === req.params.id);
  if (!anime) {
    res.status(404).json({ error: 'Anime not found' });
    return;
  }
  res.json(anime);
});

// GET /api/anime/:id/episodes/:episodeId - Get a single episode
router.get('/:id/episodes/:episodeId', (req: Request, res: Response) => {
  const anime = animeList.find((a) => a.id === req.params.id);
  if (!anime) {
    res.status(404).json({ error: 'Anime not found' });
    return;
  }
  const episode = anime.episodes.find((e) => e.id === req.params.episodeId);
  if (!episode) {
    res.status(404).json({ error: 'Episode not found' });
    return;
  }
  res.json({ anime, episode });
});

export default router;
