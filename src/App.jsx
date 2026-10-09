import { useEffect, useState } from "react";
import { MAX_ITEMS, describe, shuffle, uid } from "./text.js";
import { pickVoice, speechSupported, stopSpeaking, useVoices } from "./speech.js";
import { requestPersistence, useStored } from "./storage.js";
import Setup from "./Setup.jsx";
import Practice from "./Practice.jsx";
import Results from "./Results.jsx";
import History from "./History.jsx";

const DEFAULT_SETTINGS = { rate: 0.85, order: "sequence" };
const MAX_LOGS = 500;

// One history entry per session; rebuilt whenever self-check marks change.
function buildLog(session, marks) {
  const practiced = session.items.slice(0, session.lastRead + 1);
  const right = practiced.filter((it) => marks[it.id] === "right").length;
  const review = practiced.filter((it) => marks[it.id] === "review").length;
  return {
    id: session.logId,
    at: session.endedAt,
    listName: session.listName,
    total: session.items.length,
    practiced: practiced.length,
    right,
    review,
    seconds: session.seconds,
    items: session.items.map((it, i) => ({
      display: it.display,
      kind: it.kind,
      mark: i > session.lastRead ? "unread" : marks[it.id] || "unmarked",
    })),
  };
}

export default function App() {
  const voices = useVoices();
  const [lists, setLists] = useStored("spellwise.lists.v1", []);
  const [queue, setQueue] = useStored("spellwise.queue.v1", []);
  const [listName, setListName] = useStored("spellwise.listname.v1", "");
  const [settings, setSettings] = useStored("spellwise.settings.v1", DEFAULT_SETTINGS);
  const [history, setHistory] = useStored("spellwise.history.v1", []);
  const [phase, setPhase] = useState("setup"); // setup | practice | results | history
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    requestPersistence();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  // Stars = every item marked "Got it right", across all saved sessions.
  const stars = history.reduce((n, h) => n + (h.right || 0), 0);

  const start = (texts, name) => {
    setError("");
    if (texts.length === 0) return false;
    if (texts.length > MAX_ITEMS) {
      setError(`Please keep the list to ${MAX_ITEMS} words or fewer.`);
      return false;
    }
    if (!speechSupported) {
      setError("This browser cannot read words aloud. Try Chrome, Edge or Safari.");
      return false;
    }
    if (voices.length === 0) {
      setError("The voices are still loading. Please try again in a moment.");
      return false;
    }
    const items = texts.map((text) => ({ id: uid(), text, ...describe(text) }));
    const missing = [...new Set(items.map((i) => i.lang))].filter((l) => !pickVoice(voices, l));
    if (missing.length > 0) {
      const names = missing.map((l) => (l === "zh-CN" ? "Chinese (Simplified)" : "English"));
      setError(`No ${names.join(" or ")} voice is installed on this device.`);
      return false;
    }
    setSession({
      items: settings.order === "random" ? shuffle(items) : items,
      listName: name || "Untitled list",
      lastRead: 0,
      seconds: 0,
    });
    setPhase("practice");
    return true;
  };

  // Start from another screen; if it can't start, show the reason on the Word Chest.
  const startFrom = (texts, name) => {
    stopSpeaking();
    if (!start(texts, name)) setPhase("setup");
  };

  const finish = (lastRead, seconds) => {
    stopSpeaking();
    const done = { ...session, lastRead, seconds, logId: uid(), endedAt: Date.now() };
    setSession(done);
    setHistory((h) => [buildLog(done, {}), ...h].slice(0, MAX_LOGS));
    setPhase("results");
  };

  const updateLog = (marks) => {
    if (!session || !session.logId) return;
    const entry = buildLog(session, marks);
    setHistory((h) => h.map((e) => (e.id === entry.id ? entry : e)));
  };

  const go = (next) => {
    stopSpeaking();
    setPhase(next);
  };

  const navOn = phase === "history" ? "history" : phase === "setup" ? "setup" : "";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => phase !== "practice" && go("setup")} aria-label="SpellWise Kids home">
            <span className="brand-badge" aria-hidden="true">
              ⭐
            </span>
            <span className="brand-name">SpellWise Kids</span>
          </button>

          {phase !== "practice" && (
            <nav className="nav" aria-label="Main">
              <button className={navOn === "setup" ? "on" : ""} onClick={() => go("setup")}>
                Word Chest
              </button>
              <button className={navOn === "history" ? "on" : ""} onClick={() => go("history")}>
                Star Log
              </button>
            </nav>
          )}
          {phase === "practice" && <span className="nav-now">Spelling Adventure</span>}

          <span className="stars-pill" title="One star for every word you got right">
            <span aria-hidden="true">⭐</span> {stars} {stars === 1 ? "Star" : "Stars"}
          </span>
        </div>
      </header>

      <main className="page">
        {phase === "setup" && (
          <Setup
            queue={queue}
            setQueue={setQueue}
            lists={lists}
            setLists={setLists}
            history={history}
            setHistory={setHistory}
            listName={listName}
            setListName={setListName}
            settings={settings}
            setSettings={setSettings}
            error={error}
            clearError={() => setError("")}
            onStart={() => start(queue.map((q) => q.text), listName)}
          />
        )}
        {phase === "practice" && (
          <Practice
            items={session.items}
            listName={session.listName}
            voices={voices}
            settings={settings}
            setSettings={setSettings}
            onExit={() => go("setup")}
            onDone={finish}
          />
        )}
        {phase === "results" && (
          <Results
            key={session.logId}
            items={session.items}
            listName={session.listName}
            lastRead={session.lastRead}
            seconds={session.seconds}
            voices={voices}
            rate={settings.rate}
            onMarks={updateLog}
            onBack={() => go("setup")}
            onHistory={() => go("history")}
            onPlayAgain={() => startFrom(session.items.map((it) => it.text), session.listName)}
            onRepractice={(texts) => startFrom(texts, `Retry: ${session.listName.replace(/^Retry: /, "")}`)}
          />
        )}
        {phase === "history" && (
          <History
            history={history}
            setHistory={setHistory}
            onPlay={(texts, name) => startFrom(texts, name)}
            onStartNew={() => go("setup")}
          />
        )}
      </main>

      <footer className="footer">
        <span className="footer-brand">SpellWise Kids</span>
        <span>Lists and results are saved in this browser only.</span>
      </footer>
    </div>
  );
}
