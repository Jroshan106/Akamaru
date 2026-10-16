import express from "express";
import cors from "cors";
import animeRoutes from "./routes/anime";
import jikanRoutes from './routes/jikan';
import anikotoRoutes from './routes/anikoto';

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET"],
  }),
);
app.use(express.json());

// Routes
app.use("/api/anime", animeRoutes);
app.use('/api/jikan', jikanRoutes);
app.use('/api/anikoto', anikotoRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

export default app;

