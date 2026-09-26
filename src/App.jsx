import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_ITEMS, chunkItem, parseItems, shuffle } from "./text.js";
import { pickVoice, speak, speechSupported, stopSpeaking, useVoices } from "./speech.js";

const RATES = { slow: 0.8, normal: 1 };

export default function App() {
  const voices = useVoices();
  const [phase, setPhase] = useState("input"); // input | spell | reveal
  const [raw, setRaw] = useState("");
  const [lang, setLang] = useState("en");
  const [order, setOrder] = useState("sequence");
  const [rateKey, setRateKey] = useState("slow");
  const [session, setSession] = useState({ items: [], lang: "en" });
  const [lastRead, setLastRead] = useState(-1);
  const [error, setError] = useState("");

  const parsed = useMemo(() => parseItems(raw), [raw]);
  const langCode = lang === "en" ? "en" : "zh-CN";
  const voiceMissing =
    !speechSupported || (voices.length > 0 && !pickVoice(voices, langCode));
  const noVoicesLoaded = speechSupported && voices.length === 0;

  const start = () => {
    setError("");
    if (parsed.length === 0) return;
    if (parsed.length > MAX_ITEMS) {
      setError(`Please keep the list to ${MAX_ITEMS} items or fewer.`);
      return;
    }
    if (!speechSupported) {
      setError("This browser cannot read text aloud. Try Chrome, Edge or Safari.");
      return;
    }
    if (voiceMissing) {
      setError(
        `No ${lang === "en" ? "English" : "Chinese (Simplified)"} voice is installed on this device.`
      );
      return;
    }
    if (noVoicesLoaded) {
      setError("Voices are still loading. Please try again in a moment.");
      return;
    }
    const items = order === "random" ? shuffle(parsed) : parsed;
    setSession({ items, lang: langCode });
    setLastRead(0);
    setPhase("spell");
  };

  const finish = (maxReached) => {
    stopSpeaking();
    setLastRead(maxReached);
    setPhase("reveal");
  };

  const again = () => {
    stopSpeaking();
    setPhase("input");
  };

  return (
    <main className="app">
      <h1>Spelling Tutor</h1>

      {phase === "input" && (
        <section>
          <label htmlFor="list" className="label">
            Words or sentences (one per line)
          </label>
          <textarea
            id="list"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={10}
            placeholder={lang === "en" ? "apple\nThe quick brown fox jumps over the lazy dog" : "苹果\n今天天气很好我们去公园玩"}
          />
          <p className={parsed.length > MAX_ITEMS ? "count over" : "count"}>
            {parsed.length}/{MAX_ITEMS}
          </p>

          <fieldset>
            <legend>Language</legend>
            <label className="choice">
              <input type="radio" name="lang" checked={lang === "en"} onChange={() => setLang("en")} />
              English
            </label>
            <label className="choice">
              <input type="radio" name="lang" checked={lang === "zh"} onChange={() => setLang("zh")} />
              中文 (Simplified)
            </label>
          </fieldset>

          <fieldset>
            <legend>Order</legend>
            <label className="choice">
              <input type="radio" name="order" checked={order === "sequence"} onChange={() => setOrder("sequence")} />
              In sequence
            </label>
            <label className="choice">
              <input type="radio" name="order" checked={order === "random"} onChange={() => setOrder("random")} />
              Random
            </label>
          </fieldset>

          <fieldset>
            <legend>Speed</legend>
            <label className="choice">
              <input type="radio" name="rate" checked={rateKey === "slow"} onChange={() => setRateKey("slow")} />
              Slow
            </label>
            <label className="choice">
              <input type="radio" name="rate" checked={rateKey === "normal"} onChange={() => setRateKey("normal")} />
              Normal
            </label>
          </fieldset>

          {voiceMissing && (
            <p className="warn">
              {speechSupported
                ? `No ${lang === "en" ? "English" : "Chinese (Simplified)"} voice was found on this device.`
                : "This browser cannot read text aloud. Try Chrome, Edge or Safari."}
            </p>
          )}
          {error && <p className="warn">{error}</p>}

          <button
            className="primary"
            onClick={start}
            disabled={parsed.length === 0 || parsed.length > MAX_ITEMS}
          >
            Start spelling
          </button>
        </section>
      )}

      {phase === "spell" && (
        <Spell
          items={session.items}
          lang={session.lang}
          voices={voices}
          rate={RATES[rateKey]}
          rateKey={rateKey}
          setRateKey={setRateKey}
          onDone={finish}
        />
      )}

      {phase === "reveal" && (
        <section>
          <h2>Answers</h2>
          <ol className="answers" lang={session.lang}>
            {session.items.map((item, i) => (
              <li key={i} className={i > lastRead ? "unread" : ""}>
                {item}
                {i > lastRead && <span className="tag"> (not read)</span>}
              </li>
            ))}
          </ol>
          <button className="primary" onClick={again}>
            Start again
          </button>
        </section>
      )}
    </main>
  );
}

function Spell({ items, lang, voices, rate, rateKey, setRateKey, onDone }) {
  const [idx, setIdx] = useState(0);
  const [part, setPart] = useState(0);
  const [tick, setTick] = useState(0);
  const maxReached = useRef(0);

  // Chunks are computed but never rendered, so the words stay out of the DOM.
  const chunks = useMemo(() => chunkItem(items[idx], lang), [items, idx, lang]);
  const lastPart = part >= chunks.length - 1;
  const lastItem = idx >= items.length - 1;

  const voicesRef = useRef(voices);
  const rateRef = useRef(rate);
  voicesRef.current = voices;
  rateRef.current = rate;

  useEffect(() => {
    speak(chunks[part], lang, voicesRef.current, rateRef.current);
  }, [chunks, part, tick, lang]);

  useEffect(() => stopSpeaking, []);

  const go = (nextIdx) => {
    maxReached.current = Math.max(maxReached.current, nextIdx);
    setIdx(nextIdx);
    setPart(0);
  };

  return (
    <section className="spell">
      <p className="progress">
        Item {idx + 1} of {items.length}
      </p>
      {chunks.length > 1 && (
        <p className="part">
          Part {part + 1} of {chunks.length}
        </p>
      )}

      <button className="big" onClick={() => setTick((t) => t + 1)}>
        Repeat
      </button>

      {!lastPart && (
        <button className="big primary" onClick={() => setPart((p) => p + 1)}>
          Continue
        </button>
      )}

      <div className="nav">
        <button disabled={idx === 0} onClick={() => go(idx - 1)}>
          Prev
        </button>
        {lastItem ? (
          <button className="primary" disabled={!lastPart} onClick={() => onDone(items.length - 1)}>
            Finish
          </button>
        ) : (
          <button disabled={!lastPart} onClick={() => go(idx + 1)}>
            Next
          </button>
        )}
        <button className="danger" onClick={() => onDone(Math.max(maxReached.current, idx))}>
          End
        </button>
      </div>

      <div className="speed">
        Speed:
        <button className={rateKey === "slow" ? "on" : ""} onClick={() => setRateKey("slow")}>
          Slow
        </button>
        <button className={rateKey === "normal" ? "on" : ""} onClick={() => setRateKey("normal")}>
          Normal
        </button>
      </div>
    </section>
  );
}
