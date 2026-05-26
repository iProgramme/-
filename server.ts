import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route - Server Proxy to check balance and bypass CORS
  app.post("/api/balance", async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ success: false, message: "API key is required" });
      }

      const response = await axios.get("https://api.vectorengine.cn/api/usage/token/", {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("Balance API fetch error:", error?.response?.data || error?.message);
      res.status(200).json({
        success: false,
        message: error?.response?.data?.message || error?.message || "Failed to query usage"
      });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
