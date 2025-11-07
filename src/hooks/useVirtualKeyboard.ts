"use client";

import { useEffect } from "react";

export function useVirtualKeyboard() {
  useEffect(() => {
    const vk = (navigator as any).virtualKeyboard;
    if (!vk || typeof vk.show !== "function") {
      return;
    }

    try {
      vk.overlaysContent = true;
    } catch {}

    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!isEditableElement(target)) return;
      requestAnimationFrame(() => {
        vk.show?.().catch(() => {});
      });
    };

    document.addEventListener("focusin", handleFocus);
    return () => {
      document.removeEventListener("focusin", handleFocus);
    };
  }, []);
}

function isEditableElement(element: HTMLElement) {
  const tag = element.tagName?.toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") {
    const input = element as HTMLInputElement;
    return !input.readOnly && !input.disabled;
  }
  return element.isContentEditable;
}
