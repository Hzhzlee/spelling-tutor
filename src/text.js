export const MAX_ITEMS = 50;
export const CHUNK_SIZE = 4;

// One item per line; trim and drop blank lines.
export function parseItems(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const WORDISH = /[\p{L}\p{N}]/u;

// Chinese: one unit = one character (punctuation and spaces ignored).
// English: one unit = one word (whitespace separated, must contain a letter/digit).
export function toUnits(item, lang) {
  if (lang === "zh-CN") {
    return Array.from(item).filter((ch) => WORDISH.test(ch));
  }
  return item.split(/\s+/).filter((w) => WORDISH.test(w));
}

// More than CHUNK_SIZE units = sentence, otherwise a word.
export function isSentence(item, lang) {
  return toUnits(item, lang).length > CHUNK_SIZE;
}

// Returns the list of strings to be read, one per "Continue" step.
export function chunkItem(item, lang) {
  const units = toUnits(item, lang);
  if (units.length <= CHUNK_SIZE) {
    return [item];
  }
  const joiner = lang === "zh-CN" ? "" : " ";
  const chunks = [];
  for (let i = 0; i < units.length; i += CHUNK_SIZE) {
    chunks.push(units.slice(i, i + CHUNK_SIZE).join(joiner));
  }
  return chunks;
}

// Fisher-Yates, returns a new array.
export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
