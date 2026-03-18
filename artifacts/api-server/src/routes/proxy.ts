import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/proxy", async (req, res) => {
  const url = req.query["url"];
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url query parameter" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  const allowed = ["raw.githubusercontent.com", "github.com"];
  if (!allowed.some(host => parsed.hostname === host || parsed.hostname.endsWith("." + host))) {
    res.status(403).json({ error: "URL host not allowed" });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "BibleReader/1.0" },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `Upstream HTTP ${response.status}` });
      return;
    }

    const contentType = response.headers.get("content-type") || "application/xml";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");

    const text = await response.text();
    res.send(text);
  } catch (e: unknown) {
    res.status(502).json({ error: (e as Error).message });
  }
});

export default router;
