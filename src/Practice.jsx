import { useEffect, useMemo, useRef, useState } from "react";
import { chunkItem } from "./text.js";
import { speak, stopSpeaking } from "./speech.js";

const RATES = [0.75, 0.85, 1];

export function SpeakerIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
    </svg>
  );
}

function fmt(total) {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function Practice({ items, voices, settings, setSettings, onExit, onDone }) {
  const [idx, setIdx] = useState(0);
  const [part, setPart] = useState(0);
  const [tick, setTick] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const maxReached = useRef(0);
  const secondsRef = useRef(0);

  const item = items[idx];

  // Chunks are used only to speak; they are never rendered, so the words stay out of the DOM.
  const chunks = useMemo(() => chunkItem(item.text, item.lang), [item]);
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

  const pct = Math.round(((idx + (lastPart ? 1 : part / chunks.length)) / items.length) * 100);
  const multi = chunks.length > 1;

  return (
    <div className="practice">
      <div className="p-top">
        <button className="ghost" onClick={onExit}>
          ← Exit practice
        </button>
        <div className="p-progress">
          <span>
            Item {idx + 1} of {items.length}
          </span>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button className="accent" onClick={end}>
          Finish &amp; reveal
        </button>
      </div>

      <div className="p-body">
        <section className="card stage">
          <p className="eyebrow">
            Item {idx + 1} · {item.lang === "zh-CN" ? "Chinese spelling" : "English spelling"}
          </p>
          <p className="hidden-word" aria-label="Word hidden">
            [ Word Hidden ••• ]
          </p>

          <button className="replay" onClick={replay} aria-label="Replay audio">
            <SpeakerIcon />
          </button>
          <p className="muted">Click to replay</p>

          {multi && (
            <div className="parts">
              <p>
                Sentence part {part + 1} of {chunks.length}
              </p>
              {!lastPart && (
                <button className="primary" onClick={() => setPart((p) => p + 1)}>
                  Continue →
                </button>
              )}
            </div>
          )}

          <div className="p-nav">
            <button disabled={idx === 0} onClick={() => go(idx - 1)}>
              ← Previous
            </button>
            <button onClick={replay}>Replay</button>
            {lastItem ? (
              <button className="primary" disabled={!lastPart} onClick={end}>
                Finish
              </button>
            ) : (
              <button className="primary" disabled={!lastPart} onClick={() => go(idx + 1)}>
                Next →
              </button>
            )}
          </div>
          {multi && !lastPart && (
            <p className="muted">Finish all parts of this sentence to move on, or use Finish &amp; reveal.</p>
          )}
        </section>

        <aside className="side-col">
          <div className="card">
            <div className="row between">
              <h2>Session progress</h2>
              <span className="timer">{fmt(seconds)}</span>
            </div>
            <ul className="steps">
              {items.map((it, i) => {
                const state = i < idx ? "done" : i === idx ? "current" : "upcoming";
                return (
                  <li key={it.id} className={state}>
                    <span className="dot">{i + 1}</span>
                    <span>
                      Item {i + 1}
                      <small>
                        {state === "done" ? "Completed" : state === "current" ? "Listening now" : "Upcoming"}
                      </small>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card">
            <h2>Speech rate</h2>
            <div className="seg">
              {RATES.map((r) => (
                <button
                  key={r}
                  className={settings.rate === r ? "on" : ""}
                  onClick={() => setSettings({ ...settings, rate: r })}
                >
                  {r.toFixed(2).replace(/0$/, "")}x
                </button>
              ))}
            </div>
            <p className="muted">Applies from the next replay.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
