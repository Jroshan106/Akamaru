import express from 'express';
import cors from 'cors';
import animeRoutes from './routes/anime';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET'],
}));
app.use(express.json());

// Routes
app.use('/api/anime', animeRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Akamaru API server running on http://localhost:${PORT}`);
});
