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

// Chinese: first Mainland Mandarin voice (original behaviour).
// Chinese: first Mainland Mandarin voice (original behaviour).
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
    return (
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

let current = null; // keep a reference so the utterance is not garbage collected
let timer = null;

export function stopSpeaking() {
  if (!speechSupported) return;
  clearTimeout(timer);
  window.speechSynthesis.cancel();
  current = null;
}

export function speak(text, lang, voices, rate) {
  if (!speechSupported) return;
  stopSpeaking();
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

// True while the browser is speaking (polled; speechSynthesis has no global events).
export function useSpeaking() {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!speechSupported) return undefined;
    const t = setInterval(() => setSpeaking(window.speechSynthesis.speaking), 200);
    return () => clearInterval(t);
  }, []);
  return speaking;
}
