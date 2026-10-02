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

const isLang = (v, lang) => {
  const l = norm(v.lang);
  if (lang === "zh-CN") return (l.startsWith("zh") || l.startsWith("cmn")) && !/hk|tw|yue|hant|mo/.test(l);
  return l.startsWith("en");
};

// Novelty and low-quality engines that sound robotic.
const BAD = /espeak|compact|eloquence|novelty|whisper|bad news|good news|bells|boing|bubbles|cellos|zarvox|trinoids|albert|bahh|jester|organ|superstar|wobble|deranged|hysterical/i;
// Older Apple character voices: usable but not ideal for dictation.
const MEH = /\b(fred|junior|ralph|kathy|grandma|grandpa|rocko|shelley|flo|reed|sandy|eddy)\b/i;
// Voices that are known to sound natural.
const GOOD = /\b(samantha|ava|allison|susan|zoe|evan|nathan|joelle|noelle|karen|daniel|serena|moira|tessa|kate|oliver|aria|jenny|guy|libby|sonia|ryan|tingting|ting-ting|meijia|lilian|xiaoxiao|xiaoyi|yunxi|yunyang|huihui|yaoyao|kangkang)\b/i;

// Higher score = more natural sounding.
export function scoreVoice(v, lang) {
  const name = `${v.name || ""} ${v.voiceURI || ""}`;
  let s = 0;
  if (BAD.test(name)) s -= 100;
  if (MEH.test(name)) s -= 20;
  if (/natural|neural/i.test(name)) s += 60; // Edge "Online (Natural)" voices
  if (/premium/i.test(name)) s += 50; // Apple downloadable premium voices
  if (/enhanced/i.test(name)) s += 40;
  if (/google/i.test(name)) s += 30; // Chrome cloud voices
  if (/online/i.test(name)) s += 20;
  if (GOOD.test(name)) s += 15;
  if (v.localService === false) s += 10;
  const l = norm(v.lang);
  if (lang === "zh-CN") {
    if (l === "zh-cn" || l === "cmn-cn" || l.startsWith("zh-hans")) s += 5;
  } else if (l === "en-us") s += 5;
  else if (l === "en-gb") s += 4;
  else if (l === "en-sg" || l === "en-au") s += 3;
  return s;
}

// Voices for a language, best first.
export function voicesFor(voices, lang) {
  return voices
    .filter((v) => isLang(v, lang))
    .map((v) => ({ v, s: scoreVoice(v, lang) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v);
}

// User's chosen voice per language (voiceURI); "" means automatic.
const preferred = { en: "", "zh-CN": "" };
export function setPreferredVoices(map) {
  preferred.en = (map && map.en) || "";
  preferred["zh-CN"] = (map && map["zh-CN"]) || "";
}

export function pickVoice(voices, lang) {
  const key = lang === "zh-CN" ? "zh-CN" : "en";
  const list = voicesFor(voices, key);
  if (preferred[key]) {
    const chosen = list.find((v) => v.voiceURI === preferred[key] || v.name === preferred[key]);
    if (chosen) return chosen;
  }
  return list[0] || null;
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
