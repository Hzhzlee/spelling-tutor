"""Generate src/pinyin-data.json: a pinyin -> Chinese characters lookup used only
to make the Mandarin voice pronounce typed pinyin. Run once; output is committed.
Needs: pip install pypinyin, plus jieba's dict.txt (word frequency list).
Usage: python3 scripts/build-pinyin.py path/to/jieba/dict.txt
"""
import json, re, sys
from pypinyin import lazy_pinyin, pinyin, Style

HAN = re.compile(r"^[一-鿿]+$")
MIN_FREQ = 300  # word frequency cut-off; keeps the file small

words, chars = [], {}
for line in open(sys.argv[1], encoding="utf-8"):
    w, f, *_ = line.split()
    f = int(f)
    if not HAN.match(w):
        continue
    if len(w) == 1:
        chars[w] = max(chars.get(w, 0), f)
    elif 2 <= len(w) <= 4 and f >= MIN_FREQ:
        words.append((f, w))

def tone3(w):
    return lazy_pinyin(w, style=Style.TONE3, neutral_tone_with_five=True, v_to_u=False)

# Single syllable -> most frequent character whose main reading is that syllable.
single = {}
for ch, f in sorted(chars.items(), key=lambda x: -x[1]):
    syl = pinyin(ch, style=Style.TONE3, neutral_tone_with_five=True, heteronym=False)[0][0]
    if re.match(r"^[a-z]+[1-5]$", syl) and syl not in single:
        single[syl] = ch

# Multi-syllable words keyed by toneless pinyin; value = [[tones, word], ...] by frequency.
multi = {}
for f, w in sorted(words, key=lambda x: -x[0]):
    syls = tone3(w)
    if len(syls) != len(w) or not all(re.match(r"^[a-z]+[1-5]$", s) for s in syls):
        continue
    key = " ".join(s[:-1] for s in syls)
    tones = "".join(s[-1] for s in syls)
    bucket = multi.setdefault(key, [])
    if len(bucket) < 4 and all(t != tones for t, _ in bucket):
        bucket.append([tones, w])

out = {"single": single, "multi": multi}
json.dump(out, open("src/pinyin-data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(single), "syllables,", len(multi), "word keys")
