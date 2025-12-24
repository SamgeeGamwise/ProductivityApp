"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ListItem = {
  id: string;
  label: string;
  note?: string;
  done: boolean;
  createdAt: string;
  meta?: Record<string, unknown>;
};

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const UPDATE_EVENT = "persistent-list:update";

type PersistentListEventDetail = {
  key: string;
  items: ListItem[];
  sourceId: string;
};

export function usePersistentList(key: string, defaults: ListItem[] = []) {
  const [items, setItems] = useState<ListItem[]>(defaults);
  const [isHydrated, setIsHydrated] = useState(false);
  const instanceId = useMemo(() => createId(), []);
  const isApplyingRemoteUpdate = useRef(false);
  const defaultItemsRef = useRef(defaults.map(normalizeItem));

  useEffect(() => {
    defaultItemsRef.current = defaults.map(normalizeItem);
  }, [defaults]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(key);
    let nextItems = defaultItemsRef.current;
    if (stored) {
      try {
        nextItems = JSON.parse(stored);
      } catch {
        nextItems = defaultItemsRef.current;
      }
    }
    setItems(nextItems.map(normalizeItem));
    setIsHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    const normalized = items.map(normalizeItem);
    window.localStorage.setItem(key, JSON.stringify(normalized));
    if (isApplyingRemoteUpdate.current) {
      isApplyingRemoteUpdate.current = false;
      return;
    }
    window.dispatchEvent(
      new CustomEvent<PersistentListEventDetail>(UPDATE_EVENT, {
        detail: { key, items: normalized, sourceId: instanceId },
      })
    );
  }, [items, isHydrated, key, instanceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function applyRemoteItems(nextItems: ListItem[]) {
      isApplyingRemoteUpdate.current = true;
      setItems(nextItems.map(normalizeItem));
      setIsHydrated(true);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== key || !event.newValue) return;
      try {
        const parsed: ListItem[] = JSON.parse(event.newValue);
        applyRemoteItems(parsed);
      } catch {
        // Ignore parse errors
      }
    }

    function handleCustom(event: Event) {
      const detail = (event as CustomEvent<PersistentListEventDetail>).detail;
      if (!detail || detail.key !== key || detail.sourceId === instanceId) {
        return;
      }
      applyRemoteItems(detail.items);
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(UPDATE_EVENT, handleCustom as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(UPDATE_EVENT, handleCustom as EventListener);
    };
  }, [instanceId, key]);

  const actions = useMemo(
    () => ({
      add(label: string, note?: string, meta?: Record<string, unknown>) {
        if (!label.trim()) return;
        setItems((prev) => [
          ...prev,
          {
            id: createId(),
            label: label.trim(),
            note,
            done: false,
            createdAt: new Date().toISOString(),
            meta,
          },
        ]);
      },
      toggle(id: string) {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
      },
      remove(id: string) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      },
      reset(data: ListItem[]) {
        setItems(data.map(normalizeItem));
      },
    }),
    []
  );

  return { items, ...actions };
}

function normalizeItem(item: Partial<ListItem>): ListItem {
  return {
    id: item.id ?? createId(),
    label: item.label ?? "",
    note: item.note,
    done: Boolean(item.done),
    createdAt: item.createdAt ?? new Date().toISOString(),
    meta: item.meta,
  };
}
