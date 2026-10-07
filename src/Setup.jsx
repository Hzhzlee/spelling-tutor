import { useRef, useState } from "react";
import { MAX_ITEMS, describe, parseItems, uid } from "./text.js";
import { looksLikePinyin } from "./pinyin.js";
import { parseBackup, parseHistoryBackup } from "./storage.js";

const RATES = [0.75, 0.85, 1];

const TAGS = { en: "EN", zh: "ZH", pinyin: "PY" };

function LangTag({ text }) {
  if (badPinyin(text)) return <span className="tag bad">PY?</span>;
  return <span className="tag">{TAGS[describe(text).kind]}</span>;
}

// Typed with tone numbers or marks but not readable as pinyin (likely a typo).
function badPinyin(text) {
  return looksLikePinyin(text) && describe(text).kind !== "pinyin";
}

export default function Setup({
  queue,
  setQueue,
  lists,
  setLists,
  history,
  setHistory,
  setListName,
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
    if (badPinyin(trimmed)) {
      setNote(`"${trimmed}" isn't valid pinyin. Check the spelling, e.g. shi1 zi.`);
      return;
    }
    setQueue([...queue, { id: uid(), text: trimmed }]);
    setText("");
    setNote("");
    clearError();
  };

  const addBulk = () => {
    const lines = parseItems(bulkText);
    if (lines.length === 0) return;
    const bad = lines.filter(badPinyin);
    if (bad.length > 0) {
      setNote(`Not valid pinyin: ${bad.slice(0, 3).join(", ")}${bad.length > 3 ? "…" : ""}. Fix and add again.`);
      return;
    }
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

  // Move the item at index `from` to index `to`.
  const move = (from, to) => {
    if (to < 0 || to >= queue.length || from === to) return;
    const next = queue.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setQueue(next);
  };

  // Drag and drop (desktop); the arrow buttons cover touch screens.
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);

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
    setListName(listName);
    setName("");
    setNote(`Saved "${listName}" on this device.`);
  };

  const loadList = (list) => {
    setQueue(list.items.slice(0, MAX_ITEMS).map((t) => ({ id: uid(), text: t })));
    setListName(list.name);
    setNote(`Loaded "${list.name}".`);
    clearError();
  };

  const fileRef = useRef(null);
  const [libNote, setLibNote] = useState("");

  const exportLists = () => {
    const payload = { app: "SpellWise", version: 2, exportedAt: new Date().toISOString(), lists, history };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spellwise-lists-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setLibNote(
      `Exported ${lists.length} list${lists.length === 1 ? "" : "s"} and ${history.length} result${
        history.length === 1 ? "" : "s"
      }.`
    );
  };

  const importLists = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = String(reader.result);
      const incoming = parseBackup(json) || [];
      const logs = parseHistoryBackup(json);
      if (incoming.length === 0 && logs.length === 0) {
        setLibNote("That file isn't a SpellWise backup, or it's empty.");
        return;
      }
      // Same list name (case-insensitive) is replaced by the imported version.
      const names = new Set(incoming.map((l) => l.name.toLowerCase()));
      const kept = lists.filter((l) => !names.has(l.name.toLowerCase()));
      setLists([...incoming.map((l) => ({ ...l, id: uid() })), ...kept]);
      // Results already on this device (same id) are not duplicated.
      const have = new Set(history.map((h) => h.id));
      const fresh = logs.filter((h) => !have.has(h.id));
      setHistory([...history, ...fresh].sort((a, b) => b.at - a.at));
      setLibNote(
        `Imported ${incoming.length} list${incoming.length === 1 ? "" : "s"} and ${fresh.length} result${
          fresh.length === 1 ? "" : "s"
        }.`
      );
    };
    reader.onerror = () => setLibNote("Couldn't read that file.");
    reader.readAsText(file);
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
                  <span className="muted">{l.items.length} {l.items.length === 1 ? "item" : "items"}</span>
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
        <div className="backup">
          <button className="small" onClick={exportLists} disabled={lists.length === 0 && history.length === 0}>
            Export backup
          </button>
          <button className="small" onClick={() => fileRef.current && fileRef.current.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              importLists(e.target.files && e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
        {libNote && <p className="note">{libNote}</p>}
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
                placeholder={"One word or sentence per line\naccomplish\n图书馆\nshi1 zi"}
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
                  placeholder="English, 中文, or pinyin like shi1 zi"
                  aria-label="Word or sentence"
                />
                {trimmed && <LangTag text={trimmed} />}
                <button className="primary" onClick={addOne} disabled={!trimmed || room <= 0}>
                  Add
                </button>
              </div>
              {trimmed && describe(trimmed).kind === "pinyin" && (
                <p className="preview">
                  Shows as <strong>{describe(trimmed).display}</strong>
                </p>
              )}
              {trimmed && badPinyin(trimmed) && (
                <p className="warn">Not valid pinyin yet. Check each syllable, e.g. shi1 zi.</p>
              )}
              <p className="muted">
                Language is detected automatically. For pinyin, add tone numbers (shi1 zi, lv4 se4)
                or tone marks (shī zi); leave neutral tones without a number. Sentences longer than
                4 words, characters or syllables are read 4 at a time.
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
              <button className="small ghost" onClick={() => {
                  setQueue([]);
                  setListName("");
                }}>
                Clear all
              </button>
            )}
          </div>

          {queue.length === 0 ? (
            <p className="empty">Nothing queued yet.</p>
          ) : (
            <ol className="queue">
              {queue.map((q, i) => (
                <li
                  key={q.id}
                  draggable
                  onDragStart={(e) => {
                    setDragFrom(i);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(i));
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOver !== i) setDragOver(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFrom !== null) move(dragFrom, i);
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  onDragEnd={() => {
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  className={
                    dragFrom === i ? "dragging" : dragOver === i && dragFrom !== null ? "drop-target" : ""
                  }
                >
                  <span className="handle" aria-hidden="true" title="Drag to reorder">
                    ⋮⋮
                  </span>
                  <span className="num">{i + 1}</span>
                  <span className="q-text" lang={describe(q.text).kind === "zh" ? "zh-CN" : undefined}>
                    {describe(q.text).display}
                  </span>
                  <LangTag text={q.text} />
                  <button
                    className="icon move"
                    aria-label={`Move ${q.text} up`}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    ↑
                  </button>
                  <button
                    className="icon move"
                    aria-label={`Move ${q.text} down`}
                    disabled={i === queue.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    ↓
                  </button>
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

