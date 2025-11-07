"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type UiSettingsContextValue = {
  uiScale: number;
  setUiScale: (value: number) => void;
};

const UiSettingsContext = createContext<UiSettingsContextValue | undefined>(undefined);
const STORAGE_KEY = "home-rhythm-ui-scale";
const DEFAULT_SCALE = 1.1;

export function UiSettingsProvider({ children }: { children: React.ReactNode }) {
  const [uiScale, setUiScale] = useState(DEFAULT_SCALE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(stored) && stored >= 0.9 && stored <= 1.4) {
      setUiScale(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(uiScale));
    document.documentElement.style.setProperty("--ui-scale", String(uiScale));
    document.documentElement.style.fontSize = `${16 * uiScale}px`;
  }, [uiScale]);

  const value = useMemo(() => ({ uiScale, setUiScale }), [uiScale]);

  return <UiSettingsContext.Provider value={value}>{children}</UiSettingsContext.Provider>;
}

export function useUiSettings() {
  const context = useContext(UiSettingsContext);
  if (!context) {
    throw new Error("useUiSettings must be used within UiSettingsProvider");
  }
  return context;
}
