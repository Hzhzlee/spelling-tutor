import { useEffect, useRef, useState } from "react";
import { speak, stopSpeaking } from "./speech.js";
import { SpeakerIcon } from "./Practice.jsx";

function fmt(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default function Results({ items, lastRead, seconds, voices, rate, onMarks, onBack, onHistory, onRepractice }) {
  // marks: item id -> "right" | "review"
  const [marks, setMarks] = useState({});

  // Keep the history log in step with the self-check marks.
  const onMarksRef = useRef(onMarks);
  onMarksRef.current = onMarks;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onMarksRef.current(marks);
  }, [marks]);

  const practiced = items.slice(0, lastRead + 1);
  const right = practiced.filter((it) => marks[it.id] === "right").length;
  const missed = practiced.filter((it) => marks[it.id] === "review");
  const marked = right + missed.length;
  const accuracy = practiced.length ? Math.round((right / practiced.length) * 1000) / 10 : 0;
  const count = (k) => practiced.filter((it) => it.kind === k).length;
  const balance = [
    ["EN", count("en")],
    ["ZH", count("zh")],
    ["PY", count("pinyin")],
  ].filter(([, n]) => n > 0);

  const mark = (id, value) =>
    setMarks((m) => {
      const next = { ...m };
      if (next[id] === value) delete next[id];
      else next[id] = value;
      return next;
    });

  const play = (it) => speak(it.full, it.lang, voices, rate);

  return (
    <div className="results">
      <section className="card hero">
        <h2>{lastRead + 1 >= items.length ? "Spelling session complete!" : "Session ended early"}</h2>
        <p className="muted">
          Compare each revealed item with your paper notebook and mark how you did.
        </p>

        <div className="stats">
          <div className="stat">
            <span className="muted">Items practised</span>
            <strong>
              {practiced.length} <small>/ {items.length} total</small>
            </strong>
          </div>
          <div className="stat">
            <span className="muted">Self-check accuracy</span>
            <strong>
              {accuracy}% <small>({right} / {practiced.length})</small>
            </strong>
            {marked < practiced.length && <small className="muted">{practiced.length - marked} not yet marked</small>}
          </div>
          <div className="stat">
            <span className="muted">Time spent</span>
            <strong>{fmt(seconds)}</strong>
          </div>
          <div className="stat">
            <span className="muted">Language balance</span>
            <strong>
              {balance.length ? balance.map(([k, n]) => `${k} ${n}`).join(" · ") : "–"}
            </strong>
          </div>
        </div>
      </section>

      <div className="r-body">
        <section>
          <h2>Item-by-item reveal</h2>
          <div className="reveal-grid">
            {items.map((it, i) => {
              const read = i <= lastRead;
              const m = marks[it.id];
              return (
                <article
                  key={it.id}
                  className={`card reveal ${read ? "" : "unread"} ${m === "review" ? "flag" : ""}`}
                >
                  <div className="row between">
                    <span className="eyebrow">
                      Item {i + 1} · {{ en: "EN", zh: "ZH", pinyin: "PY" }[it.kind]}
                    </span>
                    {!read && <span className="tag">Not read</span>}
                  </div>
                  <div className="row between">
                    <p className="answer" lang={it.kind === "zh" ? "zh-CN" : undefined}>
                      {it.display}
                    </p>
                    <button className="round" onClick={() => play(it)} aria-label={`Play ${it.display}`}>
                      <SpeakerIcon />
                    </button>
                  </div>
                  {read && (
                    <div className="check">
                      <button className={m === "right" ? "good on" : "good"} onClick={() => mark(it.id, "right")}>
                        Got it right ✓
                      </button>
                      <button className={m === "review" ? "bad on" : "bad"} onClick={() => mark(it.id, "review")}>
                        Needs review ✗
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="side-col">
          <div className="card">
            <h2>Target review list</h2>
            {missed.length === 0 ? (
              <p className="empty">Items marked "Needs review" appear here.</p>
            ) : (
              <ul className="review-list">
                {missed.map((it) => (
                  <li key={it.id} lang={it.kind === "zh" ? "zh-CN" : undefined}>
                    {it.display}
                  </li>
                ))}
              </ul>
            )}
            <button
              className="primary"
              disabled={missed.length === 0}
              onClick={() => {
                stopSpeaking();
                onRepractice(missed.map((m) => m.text));
              }}
            >
              Re-practise missed items
            </button>
          </div>

          <div className="card">
            <p className="muted">This result is saved to History automatically.</p>
            <button className="wide" onClick={onHistory}>
              View history
            </button>
            <button className="wide" onClick={onBack}>
              Back to lists
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
