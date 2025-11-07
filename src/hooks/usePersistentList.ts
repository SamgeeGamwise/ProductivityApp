"use client";

import { useEffect, useMemo, useState } from "react";

export type ListItem = {
  id: string;
  label: string;
  note?: string;
  done: boolean;
};

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function usePersistentList(key: string, defaults: ListItem[] = []) {
  const [items, setItems] = useState<ListItem[]>(defaults);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(key);
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch {
        setItems(defaults);
      }
    } else {
      setItems(defaults);
    }
    setIsHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(items));
  }, [items, isHydrated, key]);

  const actions = useMemo(
    () => ({
      add(label: string, note?: string) {
        if (!label.trim()) return;
        setItems((prev) => [...prev, { id: createId(), label: label.trim(), note, done: false }]);
      },
      toggle(id: string) {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
      },
      remove(id: string) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      },
      reset(data: ListItem[]) {
        setItems(data);
      },
    }),
    []
  );

  return { items, ...actions };
}
