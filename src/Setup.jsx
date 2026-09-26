import { useState } from "react";
import { MAX_ITEMS, detectLang, parseItems, uid } from "./text.js";

const RATES = [0.75, 0.85, 1];

function LangTag({ text }) {
  return <span className="tag">{detectLang(text) === "zh-CN" ? "ZH" : "EN"}</span>;
}

export default function Setup({
  queue,
  setQueue,
  lists,
  setLists,
  settings,
  setSettings,
  error,
  clearError,
  onStart,
}) {
  const [text, setText] = useState("");
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [note, setNote] = useState("");

  const room = MAX_ITEMS - queue.length;
  const trimmed = text.trim();

  const addOne = () => {
    if (!trimmed || room <= 0) return;
    setQueue([...queue, { id: uid(), text: trimmed }]);
    setText("");
    setNote("");
    clearError();
  };

  const addBulk = () => {
    const lines = parseItems(bulkText);
    if (lines.length === 0) return;
    const take = lines.slice(0, room);
    setQueue([...queue, ...take.map((t) => ({ id: uid(), text: t }))]);
    setBulkText("");
    setBulk(false);
    setNote(
      take.length < lines.length
        ? `Added ${take.length}. ${lines.length - take.length} skipped because the limit is ${MAX_ITEMS}.`
        : ""
    );
    clearError();
  };

  const removeOne = (id) => setQueue(queue.filter((q) => q.id !== id));

  const saveList = () => {
    if (queue.length === 0) return;
    const listName = name.trim() || `List ${lists.length + 1}`;
    const entry = {
      id: uid(),
      name: listName,
      items: queue.map((q) => q.text),
      savedAt: Date.now(),
    };
    // Saving under an existing name replaces that list.
    const others = lists.filter((l) => l.name.toLowerCase() !== listName.toLowerCase());
    setLists([entry, ...others]);
    setName("");
    setNote(`Saved "${listName}" on this device.`);
  };

  const loadList = (list) => {
    setQueue(list.items.slice(0, MAX_ITEMS).map((t) => ({ id: uid(), text: t })));
    setNote(`Loaded "${list.name}".`);
    clearError();
  };

  const deleteList = (id) => {
    setLists(lists.filter((l) => l.id !== id));
    setConfirmId(null);
  };

  return (
    <div className="setup">
      {/* Library */}
      <aside className="card library">
        <h2>Unit Library</h2>
        <p className="muted">Lists are saved in this browser only.</p>
        {lists.length === 0 ? (
          <p className="empty">No saved lists yet. Build a queue, name it and press Save.</p>
        ) : (
          <ul className="lists">
            {lists.map((l) => (
              <li key={l.id}>
                <div className="list-info">
                  <strong>{l.name}</strong>
                  <span className="muted">{l.items.length} items</span>
                </div>
                {confirmId === l.id ? (
                  <div className="list-actions">
                    <button className="small danger" onClick={() => deleteList(l.id)}>
                      Delete
                    </button>
                    <button className="small" onClick={() => setConfirmId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="list-actions">
                    <button className="small" onClick={() => loadList(l)}>
                      Load
                    </button>
                    <button
                      className="small ghost"
                      aria-label={`Delete ${l.name}`}
                      onClick={() => setConfirmId(l.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Add + queue */}
      <section className="main-col">
        <div className="card">
          <div className="row between">
            <h2>Add to dictation session</h2>
            <button className="small ghost" onClick={() => setBulk((b) => !b)}>
              {bulk ? "Single add" : "Bulk paste"}
            </button>
          </div>

          {bulk ? (
            <>
              <textarea
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"One word or sentence per line\naccomplish\n图书馆"}
              />
              <div className="row end">
                <button className="primary" onClick={addBulk} disabled={!bulkText.trim() || room <= 0}>
                  Add all
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="add-row">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) addOne();
                  }}
                  placeholder="Type a word or sentence (English or 中文)"
                  aria-label="Word or sentence"
                />
                {trimmed && <LangTag text={trimmed} />}
                <button className="primary" onClick={addOne} disabled={!trimmed || room <= 0}>
                  Add
                </button>
              </div>
              <p className="muted">
                Language is detected automatically. Sentences longer than 4 words (or 4 Chinese
                characters) are read 4 at a time.
              </p>
            </>
          )}
          {room <= 0 && <p className="warn">The queue is full ({MAX_ITEMS} items).</p>}
          {note && <p className="note">{note}</p>}
        </div>

        <div className="card">
          <div className="row between">
            <h2>
              Queue List <span className={queue.length >= MAX_ITEMS ? "count over" : "count"}>
                {queue.length}/{MAX_ITEMS}
              </span>
            </h2>
            {queue.length > 0 && (
              <button className="small ghost" onClick={() => setQueue([])}>
                Clear all
              </button>
            )}
          </div>

          {queue.length === 0 ? (
            <p className="empty">Nothing queued yet.</p>
          ) : (
            <ol className="queue">
              {queue.map((q, i) => (
                <li key={q.id}>
                  <span className="num">{i + 1}</span>
                  <span className="q-text" lang={detectLang(q.text)}>
                    {q.text}
                  </span>
                  <LangTag text={q.text} />
                  <button
                    className="icon"
                    aria-label={`Remove ${q.text}`}
                    onClick={() => removeOne(q.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          )}

          {queue.length > 0 && (
            <div className="save-row">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="List name, e.g. Week 4 Spelling"
                aria-label="List name"
              />
              <button onClick={saveList}>Save list</button>
            </div>
          )}
        </div>
      </section>

      {/* Pacing + start */}
      <aside className="side-col">
        <div className="card">
          <h2>Audio pacing</h2>
          <p className="label">Speech rate</p>
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

          <p className="label">Order</p>
          <div className="seg">
            <button
              className={settings.order === "sequence" ? "on" : ""}
              onClick={() => setSettings({ ...settings, order: "sequence" })}
            >
              In sequence
            </button>
            <button
              className={settings.order === "random" ? "on" : ""}
              onClick={() => setSettings({ ...settings, order: "random" })}
            >
              Random
            </button>
          </div>
        </div>

        <div className="card start-card">
          <h2>Ready?</h2>
          <p className="muted">
            Get paper and a pen. Words are hidden while you practise and revealed at the end.
          </p>
          {error && <p className="warn">{error}</p>}
          <button
            className="primary big"
            onClick={onStart}
            disabled={queue.length === 0 || queue.length > MAX_ITEMS}
          >
            Start spelling practice
          </button>
        </div>
      </aside>
    </div>
  );
}
