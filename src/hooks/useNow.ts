"use client";

import { useEffect, useState } from "react";

const DEFAULT_REFRESH_MS = 60 * 1000;

/**
 * Returns a Date that is refreshed on an interval so time-based UI can roll forward without user action.
 */
export function useNow(intervalMs: number = DEFAULT_REFRESH_MS) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const id = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
