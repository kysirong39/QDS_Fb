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

  // API Route to verify Facebook Access Token & Account/Page Info
  app.post("/api/facebook/verify", async (req, res) => {
    const { accessToken, targetId, targetType } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "Access Token is required" });
    }

    try {
      const endpointId = targetId && targetId.trim() ? targetId.trim() : "me";
      const fbRes = await axios.get(`https://graph.facebook.com/v21.0/${endpointId}`, {
        params: {
          fields: "id,name,picture.type(large),link,category",
          access_token: accessToken,
        },
        timeout: 10000,
      });

      res.json({
        success: true,
        account: {
          id: fbRes.data.id,
          name: fbRes.data.name,
          category: fbRes.data.category || (targetType === "page" ? "Fanpage" : "Trang cá nhân"),
          picture: fbRes.data.picture?.data?.url || null,
        },
      });
    } catch (error: any) {
      console.error("Facebook verify error:", error.response?.data || error.message);
      const fbError = error.response?.data?.error?.message || "Không thể kết nối đến Facebook. Vui lòng kiểm tra lại Access Token và Page ID.";
      res.status(400).json({ error: fbError });
    }
  });

  // API Route to automatically publish a post/photo to Facebook Fanpage or Profile
  app.post("/api/facebook/publish", async (req, res) => {
    const { accessToken, targetId, message, link, imageUrl } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "Access Token is required" });
    }
    if (!message) {
      return res.status(400).json({ error: "Post message content is required" });
    }

    const destination = targetId && targetId.trim() ? targetId.trim() : "me";

    try {
      let fbRes;
      if (imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))) {
        // Publish as Photo with caption
        fbRes = await axios.post(
          `https://graph.facebook.com/v21.0/${destination}/photos`,
          null,
          {
            params: {
              url: imageUrl,
              caption: message,
              access_token: accessToken,
            },
            timeout: 20000,
          }
        );
      } else {
        // Publish as Feed status with optional link
        const params: Record<string, string> = {
          message,
          access_token: accessToken,
        };
        if (link) params.link = link;

        fbRes = await axios.post(
          `https://graph.facebook.com/v21.0/${destination}/feed`,
          null,
          {
            params,
            timeout: 20000,
          }
        );
      }

      const postId = fbRes.data.id || fbRes.data.post_id;
      res.json({
        success: true,
        postId,
        url: `https://www.facebook.com/${postId}`,
      });
    } catch (error: any) {
      console.error("Facebook publish error:", error.response?.data || error.message);
      const fbError = error.response?.data?.error?.message || "Đăng bài thất bại. Vui lòng kiểm tra quyền hạn của Access Token (pages_manage_posts) hoặc Page ID.";
      res.status(400).json({ error: fbError });
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
