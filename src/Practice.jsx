import { useEffect, useRef, useState } from "react";
import { speak, stopSpeaking, useSpeaking } from "./speech.js";
import { PACES } from "./Setup.jsx";

export function SpeakerIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
    </svg>
  );
}

function fmt(total) {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

const KIND_LABEL = { en: "English", zh: "Chinese", pinyin: "Pinyin" };

export default function Practice({ items, listName, voices, settings, setSettings, onExit, onDone }) {
  const [idx, setIdx] = useState(0);
  const [part, setPart] = useState(0);
  const [tick, setTick] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const maxReached = useRef(0);
  const secondsRef = useRef(0);
  const speaking = useSpeaking();

  const item = items[idx];

  // Chunks are used only to speak; they are never rendered, so the words stay out of the DOM.
  const chunks = item.chunks;
  const multi = chunks.length > 1;
  const lastPart = part >= chunks.length - 1;
  const lastItem = idx >= items.length - 1;

  const voicesRef = useRef(voices);
  const rateRef = useRef(settings.rate);
  voicesRef.current = voices;
  rateRef.current = settings.rate;

  useEffect(() => {
    speak(chunks[part], item.lang, voicesRef.current, rateRef.current);
  }, [chunks, part, tick, item.lang]);

  useEffect(() => stopSpeaking, []);

  useEffect(() => {
    const t = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const go = (next) => {
    maxReached.current = Math.max(maxReached.current, next);
    setIdx(next);
    setPart(0);
  };

  const end = () => onDone(Math.max(maxReached.current, idx), secondsRef.current);
  const replay = () => setTick((t) => t + 1);
  const nextPart = () => setPart((p) => p + 1);

  // Keyboard helpers: Space = hear again, Enter = next part / next word, ← = back.
  const keys = useRef({});
  keys.current = { replay, lastPart, lastItem, idx, nextPart, go, end };
  useEffect(() => {
    const down = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = keys.current;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) k.replay();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.repeat) return;
        if (!k.lastPart) k.nextPart();
        else if (k.lastItem) k.end();
        else k.go(k.idx + 1);
      } else if (e.key === "ArrowLeft" && k.idx > 0) {
        e.preventDefault();
        k.go(k.idx - 1);
      }
    };
    // Stop Space on a focused button from also clicking it.
    const up = (e) => {
      if (e.key === " " || e.code === "Space") e.preventDefault();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, []);

  const done = idx + (lastPart ? 1 : part / chunks.length);
  const pct = Math.round((done / items.length) * 100);

  return (
    <div className="adventure">
      <div className="adv-bar">
        <button className="btn btn-sm" onClick={onExit}>
          🚪 Exit to Word Chest
        </button>
        <div className="adv-progress">
          <span className="pill pill-honey">
            Word {idx + 1} of {items.length} ⭐
          </span>
          <div className="juicy" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div style={{ width: `${Math.max(pct, 3)}%` }} />
          </div>
          <span className="adv-pct">{pct}% done</span>
        </div>
        <button className="btn btn-sm btn-coral" onClick={end}>
          Finish &amp; reveal 🎁
        </button>
      </div>

      <div className="adv-grid">
        <section className="col">
          <div className="card stage">
            <div className="stage-banner">
              <span aria-hidden="true">🔮</span> {multi ? "Secret Sentence Mystery!" : "Secret Word Mystery!"}
            </div>

            <div className="bubble bubble-down">
              <span className="mascot" aria-hidden="true">
                🦉
              </span>
              <p>
                {multi
                  ? "Listen to each part, then write it in your notebook! ✏️"
                  : "Listen closely, say it out loud, and write it in your notebook! ✏️"}
              </p>
            </div>

            <button
              className={speaking ? "listen speaking" : "listen"}
              onClick={replay}
              aria-label="Hear the word again"
            >
              <span className="listen-icon">
                <SpeakerIcon size={40} />
              </span>
              <span className="listen-text">{speaking ? "LISTENING…" : "TAP TO PLAY!"}</span>
            </button>
            <p className="stage-caption">Tap to listen! 🔊</p>
            <p className="stage-meta">
              <span className="pill pill-outline">{KIND_LABEL[item.kind]}</span>
              <span className="kbd-hint">
                or press <kbd>Space</kbd>
              </span>
            </p>

            {multi && (
              <div className="helper">
                <span className="helper-icon" aria-hidden="true">
                  🧩
                </span>
                <div className="helper-text">
                  <span className="pill pill-honey-soft">Breakdown Helper</span>
                  <strong>
                    Part {part + 1} of {chunks.length}
                  </strong>
                  <small>{lastPart ? "That was the last part!" : "Write this part, then go to the next one."}</small>
                </div>
                {!lastPart && (
                  <button className="btn btn-honey" onClick={nextPart}>
                    Next part ➡️
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="card nav-card">
            <button className="btn" disabled={idx === 0} onClick={() => go(idx - 1)}>
              ⏪ Back
            </button>
            <button className="btn btn-sky-soft" onClick={replay}>
              🔁 Hear again
            </button>
            {lastItem ? (
              <button className="btn btn-honey" disabled={!lastPart} onClick={end}>
                Finish 🏁
              </button>
            ) : (
              <button className="btn btn-honey" disabled={!lastPart} onClick={() => go(idx + 1)}>
                Next word ➡️
              </button>
            )}
          </div>
          {multi && !lastPart && <p className="hint center">Finish every part to move on, or tap Finish &amp; reveal.</p>}
        </section>

        <aside className="col">
          <div className="card">
            <div className="card-head">
              <h2>
                <span aria-hidden="true">🌟</span> Star Trail
              </h2>
              <span className="timer" aria-label="Time spent">
                ⏱️ {fmt(seconds)}
              </span>
            </div>
            <p className="hint trail-list-name">{listName}</p>
            <ol className="trail">
              {items.map((it, i) => {
                const state = i < idx ? "done" : i === idx ? "current" : "locked";
                return (
                  <li key={it.id} className={state}>
                    <span className="trail-num">{state === "done" ? "✓" : i + 1}</span>
                    <span className="trail-text">
                      <strong>{state === "current" ? "Current secret" : `Word ${i + 1}`}</strong>
                      <small>{state === "done" ? "Done" : state === "current" ? "Listening now" : "Up next"}</small>
                    </span>
                    <span className="trail-end" aria-hidden="true">
                      {state === "done" ? "⭐" : state === "current" ? "😊" : "🔒"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>
                <span aria-hidden="true">🐾</span> Pacing Buddy
              </h2>
            </div>
            <div className="pace">
              {PACES.map((p) => (
                <button
                  key={p.rate}
                  className={settings.rate === p.rate ? "pace-btn on" : "pace-btn"}
                  aria-pressed={settings.rate === p.rate}
                  onClick={() => setSettings({ ...settings, rate: p.rate })}
                >
                  <span className="pace-icon" aria-hidden="true">
                    {p.icon}
                  </span>
                  <strong>{p.label}</strong>
                  <small>{p.rate.toFixed(2).replace(/0$/, "")}x</small>
                </button>
              ))}
            </div>
            <p className="hint">New speed starts from the next play.</p>
          </div>

          <div className="card keys-card">
            <div className="card-head">
              <h2>
                <span aria-hidden="true">⌨️</span> Keyboard helpers
              </h2>
            </div>
            <div className="keys">
              <span className="key-chip key-sky">
                <kbd>Space</kbd> Hear again
              </span>
              <span className="key-chip key-honey">
                <kbd>Enter</kbd> Next
              </span>
              <span className="key-chip key-coral">
                <kbd>←</kbd> Back
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
