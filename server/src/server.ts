import express from "express";
import cors from "cors";
import animeRoutes from "./routes/anime";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 4000;

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

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});
const clientDirectory = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(path.join(clientDirectory, "index.html"))) {
  app.use(express.static(clientDirectory));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDirectory, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Akamaru API server running on http://localhost:${PORT}`);
});
