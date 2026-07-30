import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for scraping
  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      
      const title = $("title").text() || $('meta[property="og:title"]').attr("content");
      const description = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content");
      
      let content = "";
      $("p, h1, h2, h3").each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) {
          content += text + "\n";
        }
        if (content.length > 2000) return false;
      });

      res.json({
        title: title?.trim(),
        description: description?.trim(),
        content: content.trim(),
        url
      });
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({ error: "Failed to scrape the URL." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
