import { useState } from "react";

const TAGS = { en: "EN", zh: "ZH", pinyin: "PY" };
const MARK = {
  right: { icon: "✓", label: "Got it right", cls: "good" },
  review: { icon: "✗", label: "Needs review", cls: "bad" },
  unmarked: { icon: "–", label: "Not marked", cls: "" },
  unread: { icon: "·", label: "Not read", cls: "dim" },
};

function when(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

function duration(s) {
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export default function History({ history, setHistory }) {
  const [open, setOpen] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const remove = (id) => {
    setHistory(history.filter((h) => h.id !== id));
    setConfirmId(null);
  };

  const sorted = history.slice().sort((a, b) => b.at - a.at);

  return (
    <div className="history">
      <div className="row between">
        <h2>Self-test history</h2>
        {history.length > 0 &&
          (confirmAll ? (
            <div className="row">
              <span className="muted">Delete all {history.length} results?</span>
              <button className="small danger" onClick={() => { setHistory([]); setConfirmAll(false); }}>
                Delete all
              </button>
              <button className="small" onClick={() => setConfirmAll(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="small ghost" onClick={() => setConfirmAll(true)}>
              Delete all
            </button>
          ))}
      </div>
      <p className="muted">
        Each session is logged when it ends. Scores update as you mark items on the results screen.
        Saved in this browser only.
      </p>

      {sorted.length === 0 ? (
        <div className="card">
          <p className="empty">No results yet. Finish a spelling session and it will appear here.</p>
        </div>
      ) : (
        <ul className="log">
          {sorted.map((h) => {
            const pct = h.practiced ? Math.round((h.right / h.practiced) * 100) : 0;
            const unmarked = h.practiced - h.right - h.review;
            const isOpen = open === h.id;
            return (
              <li key={h.id} className="card log-entry">
                <div className="log-head">
                  <div>
                    <strong>{when(h.at)}</strong>
                    <div className="muted">{h.listName}</div>
                  </div>
                  <div className="score">
                    {h.right + h.review === 0 ? (
                      <>
                        <span className="pct">–</span>
                        <small className="muted">Not marked</small>
                      </>
                    ) : (
                      <>
                        <span
                          className={
                            unmarked > 0 ? "pct" : pct >= 80 ? "pct good" : pct >= 50 ? "pct" : "pct bad"
                          }
                        >
                          {pct}%
                        </span>
                        <small className="muted">
                          {h.right}/{h.practiced} right
                        </small>
                      </>
                    )}
                  </div>
                </div>

                <p className="muted log-meta">
                  {h.practiced} of {h.total} practised · {h.review} to review
                  {unmarked > 0 ? ` · ${unmarked} not marked` : ""} · {duration(h.seconds)}
                </p>

                <div className="row log-actions">
                  <button className="small" onClick={() => setOpen(isOpen ? null : h.id)} aria-expanded={isOpen}>
                    {isOpen ? "Hide items" : "Show items"}
                  </button>
                  {confirmId === h.id ? (
                    <>
                      <button className="small danger" onClick={() => remove(h.id)}>
                        Delete
                      </button>
                      <button className="small" onClick={() => setConfirmId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="small ghost" onClick={() => setConfirmId(h.id)}>
                      Delete
                    </button>
                  )}
                </div>

                {isOpen && (
                  <ol className="log-items">
                    {h.items.map((it, i) => {
                      const m = MARK[it.mark] || MARK.unmarked;
                      return (
                        <li key={i} className={m.cls}>
                          <span className="mark" title={m.label} aria-label={m.label}>
                            {m.icon}
                          </span>
                          <span className="q-text" lang={it.kind === "zh" ? "zh-CN" : undefined}>
                            {it.display}
                          </span>
                          <span className="tag">{TAGS[it.kind]}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
