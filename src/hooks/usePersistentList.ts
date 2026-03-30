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

function readInitialItems(key: string, defaults: Array<Partial<ListItem>>) {
  const normalizedDefaults = defaults.map(normalizeItem);
  if (typeof window === "undefined") {
    return normalizedDefaults;
  }

  const stored = window.localStorage.getItem(key);
  if (!stored) {
    return normalizedDefaults;
  }

  try {
    const parsed = JSON.parse(stored) as Array<Partial<ListItem>>;
    return parsed.map(normalizeItem);
  } catch {
    return normalizedDefaults;
  }
}

export function usePersistentList(key: string, defaults: Array<Partial<ListItem>> = []) {
  const [items, setItems] = useState<ListItem[]>(() => readInitialItems(key, defaults));
  const instanceId = useMemo(() => createId(), []);
  const isApplyingRemoteUpdate = useRef(false);
  const defaultItemsRef = useRef(defaults.map(normalizeItem));

  useEffect(() => {
    defaultItemsRef.current = defaults.map(normalizeItem);
  }, [defaults]);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
  }, [items, key, instanceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function applyRemoteItems(nextItems: ListItem[]) {
      isApplyingRemoteUpdate.current = true;
      setItems(nextItems.map(normalizeItem));
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== key || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as ListItem[];
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
      reset(data: Array<Partial<ListItem>>) {
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
