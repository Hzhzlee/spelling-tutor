import { useRef, useState } from "react";
import { MAX_ITEMS, describe, parseItems, uid } from "./text.js";
import { looksLikePinyin } from "./pinyin.js";
import { parseBackup, parseHistoryBackup } from "./storage.js";
import { pickVoice, speak } from "./speech.js";

export const PACES = [
  { rate: 0.75, label: "Slow", icon: "🐢" },
  { rate: 0.85, label: "Gentle", icon: "🐰" },
  { rate: 1, label: "Speedy", icon: "🐆" },
];

export const TAGS = { en: "EN", zh: "ZH", pinyin: "PY" };

function LangTag({ text }) {
  if (badPinyin(text)) return <span className="lang lang-bad">PY?</span>;
  const kind = describe(text).kind;
  return <span className={`lang lang-${kind}`}>{TAGS[kind]}</span>;
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
  listName,
  setListName,
  settings,
  setSettings,
  voices,
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
    const newName = name.trim() || listName || `List ${lists.length + 1}`;
    const entry = {
      id: uid(),
      name: newName,
      items: queue.map((q) => q.text),
      savedAt: Date.now(),
    };
    // Saving under an existing name replaces that list.
    const others = lists.filter((l) => l.name.toLowerCase() !== newName.toLowerCase());
    setLists([entry, ...others]);
    setListName(newName);
    setName("");
    setNote(`Saved "${newName}" to your lists.`);
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
    <div className="chest">
      <section className="card hero-card">
        <div className="hero-text">
          <span className="pill pill-honey">📚 Word Chest</span>
          <h1>Build your spelling list</h1>
          <p className="sub">Add English words, 中文 or pinyin, then start the adventure.</p>
        </div>
        <div className="bubble">
          <span className="mascot" aria-hidden="true">
            🦉
          </span>
          <p>Get your notebook and pencil ready. I'll read each word, and you write it down!</p>
        </div>
      </section>

      <div className="chest-grid">
        {/* My lists */}
        <aside className="card lists-card">
          <div className="card-head">
            <h2>
              <span aria-hidden="true">🗂️</span> My Lists
            </h2>
            <span className="pill pill-outline">{lists.length}</span>
          </div>
          {lists.length === 0 ? (
            <p className="empty">No saved lists yet. Build a list, give it a name and press Save.</p>
          ) : (
            <ul className="saved-lists">
              {lists.map((l) => (
                <li key={l.id} className={listName === l.name ? "current" : ""}>
                  <div className="saved-info">
                    <strong>{l.name}</strong>
                    <span>
                      {l.items.length} {l.items.length === 1 ? "word" : "words"}
                    </span>
                  </div>
                  {confirmId === l.id ? (
                    <div className="saved-actions">
                      <button className="btn btn-sm btn-coral" onClick={() => deleteList(l.id)}>
                        Delete
                      </button>
                      <button className="btn btn-sm" onClick={() => setConfirmId(null)}>
                        Keep
                      </button>
                    </div>
                  ) : (
                    <div className="saved-actions">
                      <button className="btn btn-sm btn-sky" onClick={() => loadList(l)}>
                        Load
                      </button>
                      <button
                        className="btn btn-sm btn-plain"
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
            <button className="btn btn-sm" onClick={exportLists} disabled={lists.length === 0 && history.length === 0}>
              ⬇️ Export backup
            </button>
            <button className="btn btn-sm" onClick={() => fileRef.current && fileRef.current.click()}>
              ⬆️ Import backup
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
        <section className="col">
          <div className="card">
            <div className="card-head">
              <h2>
                <span aria-hidden="true">✏️</span> Add words
              </h2>
              <button className="btn btn-sm btn-plain" onClick={() => setBulk((b) => !b)}>
                {bulk ? "Add one at a time" : "Paste many"}
              </button>
            </div>

            {bulk ? (
              <>
                <textarea
                  className="field"
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"One word or sentence per line\naccomplish\n图书馆\nshi1 zi"}
                  aria-label="Words, one per line"
                />
                <div className="row-end">
                  <button className="btn btn-honey" onClick={addBulk} disabled={!bulkText.trim() || room <= 0}>
                    Add all
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="add-row">
                  <div className="field-wrap">
                    <input
                      className="field"
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) addOne();
                      }}
                      placeholder="Word, 中文 or pinyin (shi1 zi)"
                      aria-label="Word or sentence"
                    />
                    {trimmed && <LangTag text={trimmed} />}
                  </div>
                  <button className="btn btn-honey" onClick={addOne} disabled={!trimmed || room <= 0}>
                    Add
                  </button>
                </div>
                {trimmed && describe(trimmed).kind === "pinyin" && (
                  <p className="preview">
                    Shows as <strong>{describe(trimmed).display}</strong>
                  </p>
                )}
                {trimmed && badPinyin(trimmed) && (
                  <p className="warn">That isn't valid pinyin yet. Check each syllable, e.g. shi1 zi.</p>
                )}
                <p className="hint">
                  Pinyin: add tone numbers (shi1 zi, lv4 se4) or tone marks (shī zi). Long sentences are
                  read 4 words, characters or syllables at a time.
                </p>
              </>
            )}
            {room <= 0 && <p className="warn">Your list is full ({MAX_ITEMS} words).</p>}
            {note && <p className="note">{note}</p>}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>
                <span aria-hidden="true">🧺</span> Spelling list
                {listName && queue.length > 0 && <span className="list-name"> · {listName}</span>}
              </h2>
              <span className={queue.length >= MAX_ITEMS ? "pill pill-coral" : "pill pill-outline"}>
                {queue.length}/{MAX_ITEMS}
              </span>
            </div>

            {queue.length === 0 ? (
              <p className="empty">Your list is empty. Add some words above, or load a saved list.</p>
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
                      ⠿
                    </span>
                    <span className="num">{i + 1}</span>
                    <span className="q-text" lang={describe(q.text).kind === "zh" ? "zh-CN" : undefined}>
                      {describe(q.text).display}
                    </span>
                    <LangTag text={q.text} />
                    <span className="q-actions">
                      <button
                        className="icon-btn"
                        aria-label={`Move ${q.text} up`}
                        disabled={i === 0}
                        onClick={() => move(i, i - 1)}
                      >
                        ↑
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Move ${q.text} down`}
                        disabled={i === queue.length - 1}
                        onClick={() => move(i, i + 1)}
                      >
                        ↓
                      </button>
                      <button className="icon-btn icon-remove" aria-label={`Remove ${q.text}`} onClick={() => removeOne(q.id)}>
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {queue.length > 0 && (
              <>
                <div className="save-row">
                  <input
                    className="field"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={listName ? `Save as "${listName}" or type a new name` : "Name this list, e.g. Week 4 Spelling"}
                    aria-label="List name"
                  />
                  <button className="btn btn-sky" onClick={saveList}>
                    💾 Save list
                  </button>
                </div>
                <div className="row-end">
                  <button
                    className="btn btn-sm btn-plain"
                    onClick={() => {
                      setQueue([]);
                      setListName("");
                    }}
                  >
                    Clear list
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Pacing + start */}
        <aside className="col">
          <div className="card">
            <div className="card-head">
              <h2>
                <span aria-hidden="true">🐾</span> Pacing Buddy
              </h2>
            </div>
            <p className="hint">How fast should words be read?</p>
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

            <VoiceCheck voices={voices} rate={settings.rate} />

            <p className="label">Word order</p>
            <div className="chips">
              <button
                className={settings.order === "sequence" ? "chip on" : "chip"}
                aria-pressed={settings.order === "sequence"}
                onClick={() => setSettings({ ...settings, order: "sequence" })}
              >
                ➡️ In order
              </button>
              <button
                className={settings.order === "random" ? "chip on" : "chip"}
                aria-pressed={settings.order === "random"}
                onClick={() => setSettings({ ...settings, order: "random" })}
              >
                🔀 Mix them up
              </button>
            </div>
          </div>

          <div className="card start-card">
            <span className="start-icon" aria-hidden="true">
              🚀
            </span>
            <h2>Ready to spell?</h2>
            <p className="hint">The words stay secret until the end. Then you check your notebook!</p>
            {error && <p className="warn">{error}</p>}
            <button
              className="btn btn-honey btn-lg btn-block"
              onClick={onStart}
              disabled={queue.length === 0 || queue.length > MAX_ITEMS}
            >
              Start Adventure!
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Shows which voices this device offers to the browser, so a missing or
// still-downloading voice (e.g. Matilda Premium) is easy to spot.
function VoiceCheck({ voices, rate }) {
  const [open, setOpen] = useState(false);
  const en = pickVoice(voices, "en");
  const zh = pickVoice(voices, "zh-CN");
  const english = voices
    .filter((v) => (v.lang || "").toLowerCase().replace("_", "-").startsWith("en"))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="voice-check">
      <p className="hint">
        English voice: <strong>{en ? en.name : "none found"}</strong>
        <br />
        Chinese voice: <strong>{zh ? zh.name : "none found"}</strong>
      </p>
      <div className="voice-check-actions">
        <button className="btn btn-sm" onClick={() => speak("Hello! Let's practise spelling. Accomplish.", "en", voices, rate)}>
          🔊 Test English
        </button>
        <button className="btn btn-sm" onClick={() => speak("你好！图书馆。", "zh-CN", voices, rate)}>
          🔊 Test 中文
        </button>
      </div>
      <button className="btn btn-sm btn-plain" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide voice list" : `Voices on this device (${english.length} English)`}
      </button>
      {open && (
        <ul className="voice-list">
          {english.length === 0 && <li>No English voices found.</li>}
          {english.map((v) => (
            <li key={v.voiceURI || v.name} className={en && v === en ? "in-use" : ""}>
              {v.name} <small>({v.lang})</small>
              {en && v === en ? " ← in use" : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
