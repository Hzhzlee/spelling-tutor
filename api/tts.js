import { ttsHandler } from "./_tts-core.js";

// GET /api/tts?text=apple&lang=en&rate=0.85  →  audio/mpeg
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Use GET." });
  }
  const out = await ttsHandler(req.query || {}, process.env);
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  return res.status(out.status).send(out.body);
}
