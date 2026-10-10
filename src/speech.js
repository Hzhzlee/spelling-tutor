import { useEffect, useState } from "react";

export const speechSupported =
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;

export function useVoices() {
  const [voices, setVoices] = useState(() =>
    speechSupported ? window.speechSynthesis.getVoices() : []
  );
  useEffect(() => {
    if (!speechSupported) return undefined;
    const synth = window.speechSynthesis;
    const update = () => setVoices(synth.getVoices());
    update();
    synth.addEventListener("voiceschanged", update);
    return () => synth.removeEventListener("voiceschanged", update);
  }, []);
  return voices;
}

const norm = (l) => (l || "").toLowerCase().replace("_", "-");

// Device voices (used when the cloud voice is not set up or unreachable).
// Chinese: Han (Premium) first, then Tingting, then the first Mainland Mandarin voice.
// English: Matilda (Premium, en-AU) first, then Jamie (Premium, en-GB), then Daniel
// (en-GB); then another British,
// then any English voice on devices that have neither (e.g. Windows, Android).
// Safari may name a voice "Jamie (Premium)" or just "Jamie", so the quality tier is
// also read from voiceURI (e.g. com.apple.voice.premium.en-GB.Jamie).
const tier = (v) => {
  const id = `${v.name || ""} ${v.voiceURI || ""}`;
  if (/premium/i.test(id)) return 2;
  if (/enhanced/i.test(id)) return 1;
  return 0;
};

function best(voices, name) {
  const re = new RegExp(`\\b${name}\\b`, "i");
  const matches = voices.filter((v) => norm(v.lang).startsWith("en") && re.test(v.name || ""));
  return matches.sort((x, y) => tier(y) - tier(x))[0] || null;
}

export function pickVoice(voices, lang) {
  if (lang === "zh-CN") {
    const isZh = (v) => norm(v.lang).startsWith("zh") || norm(v.lang).startsWith("cmn");
    const mainland = (v) => isZh(v) && !/hk|tw|yue|hant/.test(norm(v.lang));
    // Han (Premium) first, then Tingting (named "Ting-Ting" on older macOS).
    const named = (re) =>
      voices.filter((v) => mainland(v) && re.test(v.name || "")).sort((x, y) => tier(y) - tier(x))[0];
    return (
      named(/\bhan\b/i) ||
      named(/\bting-?ting\b/i) ||
      voices.find((v) => ["zh-cn", "zh-hans", "zh-hans-cn", "cmn-cn"].includes(norm(v.lang))) ||
      voices.find((v) => isZh(v) && !/hk|tw|yue|hant/.test(norm(v.lang))) ||
      null
    );
  }
  const isEn = (v) => norm(v.lang).startsWith("en");
  return (
    best(voices, "matilda") ||
    best(voices, "jamie") ||
    best(voices, "daniel") ||
    voices.find((v) => norm(v.lang) === "en-gb") ||
    voices.find((v) => norm(v.lang) === "en-us") ||
    voices.find(isEn) ||
    null
  );
}

export function speakerLang(lang) {
  return lang === "zh-CN" ? "zh-CN" : "en-US";
}

// ---------------------------------------------------------------------------
// Cloud voice (Azure, via /api/tts) with the device voice as fallback.
// ---------------------------------------------------------------------------

const cloud = { status: "unknown", info: null }; // unknown | on | off
const listeners = new Set();
const setCloud = (status, info = cloud.info) => {
  cloud.status = status;
  cloud.info = info;
  listeners.forEach((fn) => fn({ ...cloud }));
};

let healthPromise = null;
export function checkCloud() {
  if (!healthPromise) {
    healthPromise = fetch("/api/health", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => setCloud(info && info.ok ? "on" : "off", info))
      .catch(() => setCloud("off", null));
  }
  return healthPromise;
}

// { status, info } — status is "unknown" until /api/health answers.
export function useCloud() {
  const [state, setState] = useState({ ...cloud });
  useEffect(() => {
    listeners.add(setState);
    checkCloud();
    setState({ ...cloud });
    return () => listeners.delete(setState);
  }, []);
  return state;
}

// One shared <audio> element. iPad Safari only lets a page play sound after a tap,
// so the first tap anywhere "unlocks" this element with a silent clip; later
// play() calls (e.g. after fetching a word) are then allowed.
const SILENT =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
const audioEl = typeof Audio !== "undefined" ? new Audio() : null;
if (audioEl) {
  audioEl.preload = "auto";
  audioEl.setAttribute("playsinline", "");
  const unlock = () => {
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
    if (audioEl.src) return;
    audioEl.src = SILENT;
    const p = audioEl.play();
    if (p && p.catch) p.catch(() => {});
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

const audioCache = new Map(); // "lang|rate|text" -> object URL (or pending promise)
const NOT_CONFIGURED = "not-configured";

function cloudAudio(text, lang, rate) {
  const key = `${lang}|${rate}|${text}`;
  if (audioCache.has(key)) return audioCache.get(key);
  const qs = new URLSearchParams({ text, lang: lang === "zh-CN" ? "zh-CN" : "en", rate: String(rate) });
  const pending = fetch(`/api/tts?${qs}`)
    .then(async (r) => {
      if (r.status === 503) throw new Error(NOT_CONFIGURED);
      if (!r.ok || !(r.headers.get("content-type") || "").includes("audio")) throw new Error(`tts ${r.status}`);
      const url = URL.createObjectURL(await r.blob());
      audioCache.set(key, Promise.resolve(url));
      return url;
    })
    .catch((e) => {
      audioCache.delete(key);
      throw e;
    });
  audioCache.set(key, pending);
  return pending;
}

// Fetch audio ahead of time so the next word plays instantly. Best effort.
export function prefetch(text, lang, rate) {
  if (cloud.status !== "on" || !text) return;
  cloudAudio(text, lang, rate).catch(() => {});
}

let current = null; // keep a reference so the utterance is not garbage collected
let timer = null;
let seq = 0; // bumps on every speak/stop so late cloud audio never plays over newer speech

export function stopSpeaking() {
  seq += 1;
  clearTimeout(timer);
  if (audioEl) audioEl.pause();
  if (speechSupported) window.speechSynthesis.cancel();
  current = null;
}

function speakDevice(text, lang, voices, rate) {
  if (!speechSupported) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = speakerLang(lang);
  const voice = pickVoice(voices, lang);
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  }
  utter.rate = rate;
  current = utter;
  // Short delay: some browsers drop speech queued right after cancel().
  timer = setTimeout(() => window.speechSynthesis.speak(utter), 60);
}

export async function speak(text, lang, voices, rate) {
  stopSpeaking();
  const token = seq;
  if (audioEl && cloud.status !== "off") {
    try {
      const url = await cloudAudio(text, lang, rate);
      if (token !== seq) return;
      audioEl.src = url;
      await audioEl.play();
      return;
    } catch (e) {
      if (e && e.message === NOT_CONFIGURED) setCloud("off");
      if (token !== seq) return;
    }
  }
  speakDevice(text, lang, voices, rate);
}

export function isSpeaking() {
  const device = speechSupported && window.speechSynthesis.speaking;
  const cloudPlaying = audioEl && !audioEl.paused && !audioEl.ended && audioEl.src !== SILENT;
  return Boolean(device || cloudPlaying);
}

// True while a word is being read (polled; neither API has a global event).
export function useSpeaking() {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setSpeaking(isSpeaking()), 200);
    return () => clearInterval(t);
  }, []);
  return speaking;
}
