// Hanyu Pinyin support.
// Typed pinyin (tone numbers "shi1 zi" or tone marks "shī zi") is shown with tone
// marks, and spoken by converting it to Chinese characters with the same sound,
// because Mandarin voices cannot read romanised pinyin reliably.
import DATA from "./pinyin-data.json";

const SINGLE = DATA.single; // "shi1" -> "师"
const MULTI = DATA.multi; // "shi zi" -> [["15","狮子"], ...]
const SYLLABLES = new Set(Object.keys(SINGLE).map((s) => s.slice(0, -1)));
const MAX_SYL = 6;

const MARKS = {
  ā: ["a", 1], á: ["a", 2], ǎ: ["a", 3], à: ["a", 4],
  ē: ["e", 1], é: ["e", 2], ě: ["e", 3], è: ["e", 4],
  ī: ["i", 1], í: ["i", 2], ǐ: ["i", 3], ì: ["i", 4],
  ō: ["o", 1], ó: ["o", 2], ǒ: ["o", 3], ò: ["o", 4],
  ū: ["u", 1], ú: ["u", 2], ǔ: ["u", 3], ù: ["u", 4],
  ǖ: ["v", 1], ǘ: ["v", 2], ǚ: ["v", 3], ǜ: ["v", 4], ü: ["v", 0],
};

const TONE_MARK_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;
const TONE_NUM_RE = /[a-zü:]+[0-5]/i;

// Cheap check: does this look like the user meant pinyin?
export function looksLikePinyin(text) {
  if (/[\u3400-\u9fff]/.test(text)) return false;
  return TONE_MARK_RE.test(text) || TONE_NUM_RE.test(text);
}

// Split letters (no digits) into valid syllables, longest match first, with backtracking.
function segment(letters) {
  const memo = new Map();
  const go = (i) => {
    if (i === letters.length) return [];
    if (memo.has(i)) return memo.get(i);
    let result = null;
    for (let len = Math.min(MAX_SYL, letters.length - i); len >= 1 && !result; len--) {
      const piece = letters.slice(i, i + len).map((l) => l.ch).join("");
      if (!SYLLABLES.has(piece)) continue;
      const rest = go(i + len);
      if (rest) result = [{ start: i, end: i + len, syl: piece }, ...rest];
    }
    memo.set(i, result);
    return result;
  };
  return go(0);
}

// Parse text into [{ syl: "shi", tone: 1 }, ...] or null if it isn't valid pinyin.
export function parsePinyin(text) {
  if (!looksLikePinyin(text)) return null;
  const clean = text
    .toLowerCase()
    .replace(/u:/g, "v")
    .replace(/[,，.。!！?？;；:：'’"“”\-–—()（）]/g, " ");
  const tokens = clean.split(/\s+/).filter(Boolean);
  const out = [];
  for (const token of tokens) {
    // Break a token into runs that end at a tone digit: "shi1zi" -> ["shi1", "zi"].
    const runs = token.match(/[^0-5]+[0-5]?|[0-5]/g) || [];
    for (const run of runs) {
      const digit = /[0-5]$/.test(run) ? Number(run.slice(-1)) : null;
      const body = digit === null ? run : run.slice(0, -1);
      if (!body) return null;
      const letters = [];
      for (const ch of body) {
        if (MARKS[ch]) letters.push({ ch: MARKS[ch][0], tone: MARKS[ch][1] });
        else if (/[a-z]/.test(ch)) letters.push({ ch, tone: 0 });
        else return null;
      }
      const parts = segment(letters);
      if (!parts) return null;
      parts.forEach((p, idx) => {
        const marked = letters.slice(p.start, p.end).find((l) => l.tone > 0);
        let tone = marked ? marked.tone : 5;
        if (!marked && digit !== null && idx === parts.length - 1) tone = digit === 0 ? 5 : digit;
        out.push({ syl: p.syl, tone });
      });
    }
  }
  return out.length ? out : null;
}

// "shi", 1 -> "shī"
function withMark(syl, tone) {
  let s = syl.replace(/v/g, "ü");
  if (tone < 1 || tone > 4) return s;
  const table = { a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", ü: "ǖǘǚǜ" };
  let pos;
  if (s.includes("a")) pos = s.indexOf("a");
  else if (s.includes("e")) pos = s.indexOf("e");
  else if (s.includes("ou")) pos = s.indexOf("o");
  else {
    for (let i = s.length - 1; i >= 0; i--) {
      if ("iouü".includes(s[i])) {
        pos = i;
        break;
      }
    }
  }
  if (pos === undefined) return s;
  return s.slice(0, pos) + table[s[pos]][tone - 1] + s.slice(pos + 1);
}

export function toMarks(syllables) {
  return syllables.map((p) => withMark(p.syl, p.tone)).join(" ");
}

const tonesMatch = (want, have) =>
  [...want].every((t, i) => t === have[i] || t === "5" || have[i] === "5");

function singleChar(syl, tone) {
  return (
    SINGLE[`${syl}${tone}`] ||
    SINGLE[`${syl}5`] ||
    SINGLE[`${syl}1`] ||
    SINGLE[`${syl}2`] ||
    SINGLE[`${syl}3`] ||
    SINGLE[`${syl}4`] ||
    ""
  );
}

// Syllables -> Chinese characters that sound the same (whole words where possible,
// so neutral tones and natural phrasing come out right).
export function toSpeech(syllables) {
  let out = "";
  let i = 0;
  while (i < syllables.length) {
    let matched = false;
    for (let len = Math.min(4, syllables.length - i); len >= 2 && !matched; len--) {
      const slice = syllables.slice(i, i + len);
      const bucket = MULTI[slice.map((p) => p.syl).join(" ")];
      if (!bucket) continue;
      const want = slice.map((p) => String(p.tone)).join("");
      const hit = bucket.find(([tones]) => tones === want) || bucket.find(([tones]) => tonesMatch(want, tones));
      if (hit) {
        out += hit[1];
        i += len;
        matched = true;
      }
    }
    if (!matched) {
      out += singleChar(syllables[i].syl, syllables[i].tone);
      i += 1;
    }
  }
  return out;
}
