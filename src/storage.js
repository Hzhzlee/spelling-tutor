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
