// Shared Azure text-to-speech logic, used by:
//  - api/tts.js and api/health.js (Vercel serverless functions)
//  - vite.config.js (local `npm run dev` / `npm run preview`)
// Files starting with "_" in api/ are not exposed as routes by Vercel.
//
// Environment variables (set in Vercel → Settings → Environment Variables):
//   AZURE_SPEECH_KEY     required  Key 1 from the Azure Speech resource
//   AZURE_SPEECH_REGION  required  e.g. southeastasia
//   AZURE_VOICE_EN       optional  default en-GB-SoniaNeural
//   AZURE_VOICE_ZH       optional  default zh-CN-XiaoxiaoNeural
// The key is only read on the server and is never returned or logged.

const MAX_CHARS = 200;
const LANGS = { en: "en-GB", "zh-CN": "zh-CN" };
const RATES = { "0.75": "-20%", "0.85": "-10%", "1": "0%" };

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

function config(env) {
  const key = (env.AZURE_SPEECH_KEY || "").trim();
  const region = (env.AZURE_SPEECH_REGION || "").trim().toLowerCase();
  return {
    key,
    region,
    ready: Boolean(key && region && /^[a-z0-9]+$/.test(region)),
    voices: {
      en: (env.AZURE_VOICE_EN || "en-GB-SoniaNeural").trim(),
      "zh-CN": (env.AZURE_VOICE_ZH || "zh-CN-XiaoxiaoNeural").trim(),
    },
  };
}

const json = (status, obj, extra = {}) => ({
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  body: JSON.stringify(obj),
});

// params: { text, lang, rate } from the query string.
export async function ttsHandler(params, env, fetchImpl = fetch) {
  const cfg = config(env);
  if (!cfg.ready) {
    return json(503, {
      error: "AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are not set. Add them in Vercel and redeploy.",
    });
  }

  const text = String(params.text || "").trim();
  const lang = String(params.lang || "en");
  const rate = String(params.rate || "1");
  if (!text) return json(400, { error: "Missing text." });
  if (text.length > MAX_CHARS) return json(400, { error: `Text is longer than ${MAX_CHARS} characters.` });
  if (!LANGS[lang]) return json(400, { error: "lang must be en or zh-CN." });
  if (!RATES[rate]) return json(400, { error: "rate must be 0.75, 0.85 or 1." });

  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${LANGS[lang]}">` +
    `<voice name="${escapeXml(cfg.voices[lang])}"><prosody rate="${RATES[rate]}">${escapeXml(text)}</prosody></voice>` +
    `</speak>`;

  let upstream;
  try {
    upstream = await fetchImpl(`https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": cfg.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "spellwise-kids",
      },
      body: ssml,
    });
  } catch {
    return json(502, { error: "Could not reach Azure Speech." });
  }

  if (!upstream.ok) {
    const reason =
      upstream.status === 401 || upstream.status === 403
        ? "Azure rejected the key or region. Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION."
        : upstream.status === 429
          ? "Azure free allowance or rate limit reached. Try again later."
          : "Azure Speech returned an error.";
    return json(upstream.status, { error: reason, upstreamStatus: upstream.status });
  }

  const audio = Buffer.from(await upstream.arrayBuffer());
  if (audio.length === 0) return json(502, { error: "Azure returned no audio." });

  return {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      // Same text + voice + speed always gives the same audio, so let browsers and
      // Vercel's CDN keep it. This also keeps Azure usage low.
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
    body: audio,
  };
}

// Reports whether the key is set and whether Azure accepts it. Never returns the key.
export async function healthHandler(env, fetchImpl = fetch) {
  const cfg = config(env);
  const base = { keyConfigured: Boolean(cfg.key), region: cfg.region || null, voices: cfg.voices };
  if (!cfg.ready) return json(200, { ...base, ok: false, reason: "Key or region not set." });
  try {
    const r = await fetchImpl(`https://${cfg.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": cfg.key, "Content-Length": "0" },
    });
    return json(200, {
      ...base,
      ok: r.ok,
      upstreamStatus: r.status,
      ...(r.ok ? {} : { reason: "Azure rejected the key or region." }),
    });
  } catch {
    return json(200, { ...base, ok: false, reason: "Could not reach Azure." });
  }
}
