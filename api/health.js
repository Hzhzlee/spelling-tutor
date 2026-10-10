import { healthHandler } from "./_tts-core.js";

// GET /api/health  →  { keyConfigured, region, ok, upstreamStatus, voices }
export default async function handler(req, res) {
  const out = await healthHandler(process.env);
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  return res.status(out.status).send(out.body);
}
