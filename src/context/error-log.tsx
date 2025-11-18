"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ErrorLogEntry = {
  id: string;
  source: string;
  message: string;
  timestamp: number;
};

type ErrorLogContextValue = {
  entries: ErrorLogEntry[];
  logError: (source: string, error: unknown) => void;
  clearEntries: () => void;
};

const STORAGE_KEY = "error-log-entries";
const MAX_ENTRIES = 200;

const ErrorLogContext = createContext<ErrorLogContextValue | undefined>(undefined);

export function ErrorLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ErrorLogEntry[]>(() => loadStoredEntries());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore storage failures
    }
  }, [entries]);

  const logError = useCallback((source: string, error: unknown) => {
    setEntries((prev) => {
      const nextEntry: ErrorLogEntry = {
        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source,
        message: describeError(error),
        timestamp: Date.now(),
      };
      const next = [nextEntry, ...prev];
      return next.slice(0, MAX_ENTRIES);
    });
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
  }, []);

  const value = useMemo(
    () => ({
      entries,
      logError,
      clearEntries,
    }),
    [entries, logError, clearEntries]
  );

  return <ErrorLogContext.Provider value={value}>{children}</ErrorLogContext.Provider>;
}

export function useErrorLog() {
  const context = useContext(ErrorLogContext);
  if (!context) {
    throw new Error("useErrorLog must be used within an ErrorLogProvider");
  }
  return context;
}

function loadStoredEntries(): ErrorLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    const sanitized = parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const { id, source, message, timestamp } = item as Partial<ErrorLogEntry>;
        if (typeof id !== "string" || typeof source !== "string" || typeof message !== "string") {
          return null;
        }
        return {
          id,
          source,
          message,
          timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        };
      })
      .filter(Boolean) as ErrorLogEntry[];
    return sanitized.slice(0, MAX_ENTRIES);
  } catch {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return [];
  }
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}
