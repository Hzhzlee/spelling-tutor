import { useEffect, useState } from "react";

// localStorage-backed state. Every access is wrapped: storage can be blocked
// (private mode, site data disabled) and the app must still work without it.
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw);
      const ok =
        Array.isArray(initial) === Array.isArray(parsed) &&
        typeof parsed === typeof initial;
      return ok ? parsed : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [key, value]);

  return [value, setValue];
}

// Ask the browser not to evict our data under storage pressure. Best effort only.
export function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then((already) => {
        if (!already) navigator.storage.persist().catch(() => {});
      }).catch(() => {});
    }
  } catch {
    /* not supported */
  }
}

// Validate an imported backup; returns clean lists or null.
export function parseBackup(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const raw = Array.isArray(data) ? data : data && Array.isArray(data.lists) ? data.lists : null;
  if (!raw) return null;
  const clean = raw
    .filter((l) => l && typeof l.name === "string" && Array.isArray(l.items))
    .map((l) => ({
      name: l.name.trim().slice(0, 80) || "Imported list",
      items: l.items.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()).slice(0, 50),
      savedAt: Number.isFinite(l.savedAt) ? l.savedAt : Date.now(),
    }))
    .filter((l) => l.items.length > 0);
  return clean;
}

// Validate history entries from an imported backup; returns [] if none.
export function parseHistoryBackup(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const raw = data && Array.isArray(data.history) ? data.history : [];
  const num = (n) => (Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
  const MARKS = ["right", "review", "unmarked", "unread"];
  const KINDS = ["en", "zh", "pinyin"];
  return raw
    .filter((h) => h && typeof h.id === "string" && Number.isFinite(h.at) && Array.isArray(h.items))
    .map((h) => ({
      id: h.id,
      at: h.at,
      listName: typeof h.listName === "string" ? h.listName.slice(0, 120) : "Untitled list",
      total: num(h.total),
      practiced: num(h.practiced),
      right: num(h.right),
      review: num(h.review),
      seconds: num(h.seconds),
      items: h.items
        .filter((it) => it && typeof it.display === "string")
        .slice(0, 50)
        .map((it) => ({
          display: it.display,
          kind: KINDS.includes(it.kind) ? it.kind : "en",
          mark: MARKS.includes(it.mark) ? it.mark : "unmarked",
        })),
    }));
}
