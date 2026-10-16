import app from "./app";
import express from "express";
import path from "path";
import fs from "fs";

const PORT = process.env.PORT || 4000;
const clientDirectory = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(path.join(clientDirectory, "index.html"))) {
  app.use(express.static(clientDirectory));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDirectory, "index.html"));
  });
}
app.listen(PORT, () => {
  console.log(`Akamaru running on http://localhost:${PORT}`);
});
