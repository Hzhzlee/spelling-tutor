import { useEffect, useRef, useState } from "react";
import { speak, stopSpeaking } from "./speech.js";
import { SpeakerIcon } from "./Practice.jsx";
import { TAGS } from "./Setup.jsx";

function fmt(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

// Honest, encouraging headline that matches what actually happened.
function headline({ finished, practised, right, marked }) {
  if (marked < practised) {
    return {
      emoji: "📓",
      title: finished ? "All done! Time to check." : "Good effort! Time to check.",
      sub: "Open your notebook and compare each word below. Tap Nailed it! or Needs practice.",
    };
  }
  const pct = practised ? right / practised : 0;
  if (pct === 1) return { emoji: "🏆", title: "WHOOHOO! PERFECT RUN!", sub: "Every word spelled right. Brilliant work!" };
  if (pct >= 0.8) return { emoji: "🎉", title: "Fantastic spelling!", sub: "Nearly all correct. Try the tricky ones again to make them stick." };
  if (pct >= 0.5) return { emoji: "💪", title: "Great effort!", sub: "You're getting there. Every mistake helps your brain grow!" };
  return { emoji: "🌱", title: "Keep going, you've got this!", sub: "Practise the tricky words again. Each try makes you stronger!" };
}

export default function Results({
  items,
  listName,
  lastRead,
  seconds,
  voices,
  rate,
  onMarks,
  onBack,
  onHistory,
  onPlayAgain,
  onRepractice,
}) {
  // marks: item id -> "right" | "review"
  const [marks, setMarks] = useState({});

  // Keep the Star Log entry in step with the self-check marks.
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

  const practised = items.slice(0, lastRead + 1);
  const right = practised.filter((it) => marks[it.id] === "right").length;
  const missed = practised.filter((it) => marks[it.id] === "review");
  const marked = right + missed.length;
  const accuracy = marked ? Math.round((right / practised.length) * 100) : null;
  const finished = lastRead + 1 >= items.length;
  const head = headline({ finished, practised: practised.length, right, marked });

  const mark = (id, value) =>
    setMarks((m) => {
      const next = { ...m };
      if (next[id] === value) delete next[id];
      else next[id] = value;
      return next;
    });

  const play = (it) => speak(it.full, it.lang, voices, rate);

  return (
    <div className="trophy">
      <section className="card celebrate">
        <span className="float float-1" aria-hidden="true">
          ✨
        </span>
        <span className="float float-2" aria-hidden="true">
          🌟
        </span>
        <span className="pill pill-white">🎯 {listName}</span>
        <h1>
          <span aria-hidden="true">{head.emoji}</span> {head.title}
        </h1>
        <p>{head.sub}</p>
      </section>

      <div className="tiles">
        <div className="tile tile-honey">
          <span className="tile-label">Words done</span>
          <strong>
            {practised.length} / {items.length} <span aria-hidden="true">⭐</span>
          </strong>
          <small>{finished ? "Whole list finished" : "Ended early"}</small>
        </div>
        <div className="tile tile-white">
          <span className="tile-label">Self-check</span>
          <strong>{accuracy === null ? "–" : `${accuracy}%`}</strong>
          <small>
            {marked < practised.length ? `${practised.length - marked} still to check` : `${right} of ${practised.length} right`}
          </small>
        </div>
        <div className="tile tile-sky">
          <span className="tile-label">Speed run</span>
          <strong>
            {fmt(seconds)} <span aria-hidden="true">⏱️</span>
          </strong>
          <small>Time spent listening</small>
        </div>
        <div className="tile tile-coral">
          <span className="tile-label">Stars earned</span>
          <strong>
            +{right} <span aria-hidden="true">⭐</span>
          </strong>
          <small>One star per word right</small>
        </div>
      </div>

      <div className="trophy-grid">
        <section className="card">
          <div className="card-head">
            <h2>
              <span aria-hidden="true">📜</span> Your words revealed!
            </h2>
            <span className="pill pill-outline">Check your notebook</span>
          </div>

          <div className="reveal-grid">
            {items.map((it, i) => {
              const read = i <= lastRead;
              const m = marks[it.id];
              const cls = ["reveal", !read && "unread", m === "right" && "is-right", m === "review" && "is-review"]
                .filter(Boolean)
                .join(" ");
              return (
                <article key={it.id} className={cls}>
                  <div className="reveal-top">
                    <span className="pill pill-honey-soft">
                      Word {i + 1} · {TAGS[it.kind]}
                    </span>
                    {!read && <span className="pill pill-outline">Not read</span>}
                    {m === "right" && <span className="stamp stamp-mint">✓</span>}
                    {m === "review" && <span className="stamp stamp-coral">↻</span>}
                  </div>
                  <div className="reveal-word">
                    <p className="answer" lang={it.kind === "zh" ? "zh-CN" : undefined}>
                      {it.display}
                    </p>
                    <button className="mini-listen" onClick={() => play(it)} aria-label={`Hear ${it.display}`}>
                      <SpeakerIcon size={22} />
                    </button>
                  </div>
                  {read && (
                    <div className="rate-row">
                      <button
                        className={m === "right" ? "btn btn-sm btn-honey on" : "btn btn-sm"}
                        aria-pressed={m === "right"}
                        onClick={() => mark(it.id, "right")}
                      >
                        Nailed it! ⭐
                      </button>
                      <button
                        className={m === "review" ? "btn btn-sm btn-coral on" : "btn btn-sm"}
                        aria-pressed={m === "review"}
                        onClick={() => mark(it.id, "review")}
                      >
                        Needs practice 💪
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="col">
          <div className="card chest-card">
            <div className="card-head">
              <h2>
                <span aria-hidden="true">🧰</span> Review Chest
              </h2>
              <span className="pill pill-outline">
                {missed.length} to practise
              </span>
            </div>
            {missed.length === 0 ? (
              <p className="hint">Words you mark "Needs practice" are kept here so you can try them again.</p>
            ) : (
              <div className="word-chips">
                {missed.map((it) => (
                  <span key={it.id} className="word-chip" lang={it.kind === "zh" ? "zh-CN" : undefined}>
                    {it.display}
                  </span>
                ))}
              </div>
            )}
            <button
              className="btn btn-navy btn-block"
              disabled={missed.length === 0}
              onClick={() => {
                stopSpeaking();
                onRepractice(missed.map((m) => m.text));
              }}
            >
              🔄 Try missed words now
            </button>
          </div>

          <button className="btn btn-honey btn-lg btn-block" onClick={onPlayAgain}>
            🎮 Play this list again
          </button>
          <button className="btn btn-lg btn-block" onClick={onHistory}>
            📖 View Star Log
          </button>
          <button className="btn btn-block btn-plain-border" onClick={onBack}>
            ← Back to Word Chest
          </button>
          <p className="hint center">This result is saved in your Star Log automatically.</p>
        </aside>
      </div>
    </div>
  );
}
