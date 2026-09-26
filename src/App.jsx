import { useState } from "react";
import { MAX_ITEMS, detectLang, shuffle, uid } from "./text.js";
import { pickVoice, speechSupported, stopSpeaking, useVoices } from "./speech.js";
import { useStored } from "./storage.js";
import Setup from "./Setup.jsx";
import Practice from "./Practice.jsx";
import Results from "./Results.jsx";

const DEFAULT_SETTINGS = { rate: 0.85, order: "sequence" };

export default function App() {
  const voices = useVoices();
  const [lists, setLists] = useStored("spellwise.lists.v1", []);
  const [queue, setQueue] = useStored("spellwise.queue.v1", []);
  const [settings, setSettings] = useStored("spellwise.settings.v1", DEFAULT_SETTINGS);
  const [phase, setPhase] = useState("setup"); // setup | practice | results
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  const start = (texts) => {
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
    const items = texts.map((text) => ({ id: uid(), text, lang: detectLang(text) }));
    const missing = [...new Set(items.map((i) => i.lang))].filter((l) => !pickVoice(voices, l));
    if (missing.length > 0) {
      const names = missing.map((l) => (l === "zh-CN" ? "Chinese (Simplified)" : "English"));
      setError(`No ${names.join(" or ")} voice is installed on this device.`);
      return;
    }
    setSession({
      items: settings.order === "random" ? shuffle(items) : items,
      lastRead: 0,
      seconds: 0,
    });
    setPhase("practice");
  };

  const finish = (lastRead, seconds) => {
    stopSpeaking();
    setSession((s) => ({ ...s, lastRead, seconds }));
    setPhase("results");
  };

  const backToSetup = () => {
    stopSpeaking();
    setPhase("setup");
  };

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">S</span>
          SpellWise
        </div>
        <span className="crumb">
          {phase === "setup" && "Dictation · Spelling list"}
          {phase === "practice" && "Dictation · Practice"}
          {phase === "results" && "Dictation · Results"}
        </span>
      </header>

      <main className="page">
        {phase === "setup" && (
          <Setup
            queue={queue}
            setQueue={setQueue}
            lists={lists}
            setLists={setLists}
            settings={settings}
            setSettings={setSettings}
            error={error}
            clearError={() => setError("")}
            onStart={() => start(queue.map((q) => q.text))}
          />
        )}
        {phase === "practice" && (
          <Practice
            items={session.items}
            voices={voices}
            settings={settings}
            setSettings={setSettings}
            onExit={backToSetup}
            onDone={finish}
          />
        )}
        {phase === "results" && (
          <Results
            items={session.items}
            lastRead={session.lastRead}
            seconds={session.seconds}
            voices={voices}
            rate={settings.rate}
            onBack={backToSetup}
            onRepractice={(texts) => {
              // Fall back to the setup screen so any error is visible there.
              setPhase("setup");
              start(texts);
            }}
          />
        )}
      </main>
    </div>
  );
}
