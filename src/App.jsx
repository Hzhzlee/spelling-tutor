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

  const start = (texts, name) => {
    setError("");
    if (texts.length === 0) return;
    if (texts.length > MAX_ITEMS) {
      setError(`Please keep the list to ${MAX_ITEMS} items or fewer.`);
      return;
    }
    if (!speechSupported) {
      setError("This browser cannot read text aloud. Try Chrome, Edge or Safari.");
      return;
    }
    if (voices.length === 0) {
      setError("Voices are still loading. Please try again in a moment.");
      return;
    }
    const items = texts.map((text) => ({ id: uid(), text, ...describe(text) }));
    const missing = [...new Set(items.map((i) => i.lang))].filter((l) => !pickVoice(voices, l));
    if (missing.length > 0) {
      const names = missing.map((l) => (l === "zh-CN" ? "Chinese (Simplified)" : "English"));
      setError(`No ${names.join(" or ")} voice is installed on this device.`);
      return;
    }
    setSession({
      items: settings.order === "random" ? shuffle(items) : items,
      listName: name || "Untitled list",
      lastRead: 0,
      seconds: 0,
    });
    setPhase("practice");
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

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">S</span>
          SpellWise
        </div>
        {phase !== "practice" && (
          <nav className="tabs">
            <button className={phase !== "history" ? "on" : ""} onClick={() => go("setup")}>
              Practice
            </button>
            <button className={phase === "history" ? "on" : ""} onClick={() => go("history")}>
              History{history.length > 0 ? ` (${history.length})` : ""}
            </button>
          </nav>
        )}
        {phase === "practice" && <span className="crumb">Dictation · Practice</span>}
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
            lastRead={session.lastRead}
            seconds={session.seconds}
            voices={voices}
            rate={settings.rate}
            onMarks={updateLog}
            onBack={() => go("setup")}
            onHistory={() => go("history")}
            onRepractice={(texts) => {
              // Fall back to the setup screen so any error is visible there.
              setPhase("setup");
              start(texts, `Re-practice: ${session.listName}`);
            }}
          />
        )}
        {phase === "history" && <History history={history} setHistory={setHistory} />}
      </main>
    </div>
  );
}
