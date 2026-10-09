import { useMemo, useState } from "react";
import { TAGS } from "./Setup.jsx";

const MARK = {
  right: { icon: "⭐", label: "Got it right", cls: "w-right" },
  review: { icon: "💪", label: "Needs practice", cls: "w-review" },
  unmarked: { icon: "○", label: "Not checked", cls: "" },
  unread: { icon: "·", label: "Not read", cls: "w-unread" },
};

function when(ts) {
  const d = new Date(ts);
  const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  const time = d.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" });
  if (diff === 0) return `Today at ${time}`;
  if (diff === 1) return `Yesterday at ${time}`;
  const date = d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return `${date}, ${time}`;
}

function minutes(s) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Consecutive days, ending today or yesterday, with at least one session.
function streak(history) {
  const days = new Set(
    history.map((h) => {
      const d = new Date(h.at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const d = new Date();
  if (!days.has(key(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(key(d))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function status(h) {
  const checked = h.right + h.review;
  if (h.practiced === 0 || checked === 0) return "unchecked";
  if (h.right === h.practiced) return "perfect";
  if (h.review > 0) return "review";
  return "partial";
}

const STATUS = {
  perfect: { icon: "🏆", stripe: "stripe-honey" },
  review: { icon: "🎯", stripe: "stripe-coral" },
  partial: { icon: "📝", stripe: "stripe-mint" },
  unchecked: { icon: "📓", stripe: "stripe-sky" },
};

export default function History({ history, setHistory, onPlay, onStartNew }) {
  const [confirmId, setConfirmId] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => history.slice().sort((a, b) => b.at - a.at), [history]);

  const stats = useMemo(() => {
    const right = history.reduce((n, h) => n + h.right, 0);
    const checked = history.reduce((n, h) => n + h.right + h.review, 0);
    return {
      sessions: history.length,
      right,
      checked,
      accuracy: checked ? Math.round((right / checked) * 100) : null,
      seconds: history.reduce((n, h) => n + (h.seconds || 0), 0),
      streak: streak(history),
    };
  }, [history]);

  const counts = useMemo(() => {
    const c = { all: sorted.length, perfect: 0, review: 0, unchecked: 0 };
    sorted.forEach((h) => {
      const s = status(h);
      if (s in c) c[s] += 1;
    });
    return c;
  }, [sorted]);

  const q = query.trim().toLowerCase();
  const shown = sorted.filter((h) => {
    if (filter !== "all" && status(h) !== filter) return false;
    if (!q) return true;
    return h.listName.toLowerCase().includes(q) || h.items.some((it) => it.display.toLowerCase().includes(q));
  });

  const remove = (id) => {
    setHistory(history.filter((h) => h.id !== id));
    setConfirmId(null);
  };

  return (
    <div className="starlog">
      <section className="card hero-card">
        <div className="hero-text">
          <span className="pill pill-honey">🏅 Star Log</span>
          <h1>Spelling history</h1>
          <p className="sub">"Every mistake helps your brain grow!" 🧠✨</p>
        </div>
        <div className="hero-stars" aria-label={`${stats.right} stars collected`}>
          <span className="hero-stars-icon" aria-hidden="true">
            ⭐
          </span>
          <strong>{stats.right}</strong>
          <small>stars collected</small>
        </div>
      </section>

      <div className="tiles">
        <div className="tile tile-white">
          <span className="tile-icon tile-icon-sky" aria-hidden="true">
            🗺️
          </span>
          <span className="tile-label">Adventures</span>
          <strong>{stats.sessions}</strong>
          <small>{stats.sessions === 1 ? "session played" : "sessions played"}</small>
        </div>
        <div className="tile tile-white">
          <span className="tile-icon tile-icon-honey" aria-hidden="true">
            🎯
          </span>
          <span className="tile-label">Star accuracy</span>
          <strong>{stats.accuracy === null ? "–" : `${stats.accuracy}%`}</strong>
          <small>
            {stats.checked ? `${stats.right} of ${stats.checked} checked words right` : "Check words to see this"}
          </small>
        </div>
        <div className="tile tile-white">
          <span className="tile-icon tile-icon-coral" aria-hidden="true">
            ⏳
          </span>
          <span className="tile-label">Time practising</span>
          <strong>{minutes(stats.seconds)}</strong>
          <small>Listening and writing</small>
        </div>
        <div className="tile tile-white">
          <span className="tile-icon tile-icon-mint" aria-hidden="true">
            🔥
          </span>
          <span className="tile-label">Current streak</span>
          <strong>
            {stats.streak} {stats.streak === 1 ? "day" : "days"}
          </strong>
          <small>{stats.streak > 1 ? "Keep it going!" : "Practise daily to build it"}</small>
        </div>
      </div>

      {sorted.length > 0 && (
        <div className="card filter-bar">
          <label className="search">
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lists or words…"
              aria-label="Search lists or words"
            />
          </label>
          <div className="chips">
            {[
              ["all", "All", ""],
              ["perfect", "Perfect 100%", "🌟 "],
              ["review", "Needs review", "💪 "],
              ["unchecked", "Not checked", "📓 "],
            ].map(([key, label, icon]) => (
              <button
                key={key}
                className={filter === key ? "chip on" : "chip"}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {icon}
                {label} <span className="chip-count">{counts[key]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="card empty-card">
          <span className="big-emoji" aria-hidden="true">
            🦉
          </span>
          <h2>No adventures yet</h2>
          <p className="hint">Finish a spelling session and it will appear here.</p>
          <button className="btn btn-honey" onClick={onStartNew}>
            Start an adventure
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="card empty-card">
          <p className="hint">Nothing matches. Try another search or filter.</p>
        </div>
      ) : (
        <ul className="log">
          {shown.map((h) => {
            const s = status(h);
            const pct = h.practiced ? Math.round((h.right / h.practiced) * 100) : 0;
            const unchecked = h.practiced - h.right - h.review;
            const tricky = h.items.filter((it) => it.mark === "review");
            return (
              <li key={h.id} className={`card log-entry ${STATUS[s].stripe}`}>
                <div className="log-head">
                  <span className="log-icon" aria-hidden="true">
                    {STATUS[s].icon}
                  </span>
                  <div className="log-title">
                    <h3>
                      {h.listName}
                      {s === "perfect" && <span className="pill pill-honey">100% Gold Star 🏆</span>}
                      {(s === "review" || s === "partial") && <span className="pill pill-sky-soft">{pct}%</span>}
                      {s === "unchecked" && <span className="pill pill-outline">Not checked yet</span>}
                    </h3>
                    <p className="hint">
                      {when(h.at)} · {h.practiced} of {h.total} words · {minutes(h.seconds || 0)}
                      {unchecked > 0 && s !== "unchecked" ? ` · ${unchecked} not checked` : ""}
                    </p>
                  </div>
                  <span className="score-pill" aria-label={`${h.right} of ${h.practiced} stars`}>
                    {h.right} / {h.practiced} <small>Stars</small>
                  </span>
                </div>

                <div className="showcase">
                  {h.items.map((it, i) => {
                    const m = MARK[it.mark] || MARK.unmarked;
                    return (
                      <span
                        key={i}
                        className={`word-chip ${m.cls}`}
                        title={m.label}
                        lang={it.kind === "zh" ? "zh-CN" : undefined}
                      >
                        <span aria-label={m.label}>{m.icon}</span> {it.display}
                        <span className="sr-only"> ({TAGS[it.kind]})</span>
                      </span>
                    );
                  })}
                </div>

                {tricky.length > 0 && (
                  <div className="tricky">
                    <span aria-hidden="true">💡</span>
                    <span>
                      <strong>Words to review:</strong> {tricky.map((t) => t.display).join(", ")}
                    </span>
                  </div>
                )}

                <div className="log-actions">
                  {confirmId === h.id ? (
                    <span className="confirm">
                      Delete this result?
                      <button className="btn btn-sm btn-coral" onClick={() => remove(h.id)}>
                        Delete
                      </button>
                      <button className="btn btn-sm" onClick={() => setConfirmId(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button className="btn btn-sm btn-plain" onClick={() => setConfirmId(h.id)}>
                      🗑️ Delete
                    </button>
                  )}
                  <span className="spacer" />
                  {tricky.length > 0 && (
                    <button
                      className="btn btn-sm btn-sky"
                      onClick={() => onPlay(tricky.map((t) => t.display), `Retry: ${h.listName.replace(/^Retry: /, "")}`)}
                    >
                      🎯 Retry tricky words
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-honey"
                    onClick={() => onPlay(h.items.map((t) => t.display), h.listName)}
                  >
                    🔁 Play again
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sorted.length > 0 && (
        <div className="card next-card">
          <span className="big-emoji" aria-hidden="true">
            🎒
          </span>
          <div>
            <h2>Ready for your next adventure?</h2>
            <p className="hint">Build a new list in the Word Chest.</p>
          </div>
          <button className="btn btn-sky" onClick={onStartNew}>
            Go to Word Chest
          </button>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="row-end danger-zone">
          {confirmAll ? (
            <span className="confirm">
              Delete all {history.length} results?
              <button
                className="btn btn-sm btn-coral"
                onClick={() => {
                  setHistory([]);
                  setConfirmAll(false);
                }}
              >
                Delete all
              </button>
              <button className="btn btn-sm" onClick={() => setConfirmAll(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button className="btn btn-sm btn-plain" onClick={() => setConfirmAll(true)}>
              Delete all results
            </button>
          )}
        </div>
      )}
    </div>
  );
}
