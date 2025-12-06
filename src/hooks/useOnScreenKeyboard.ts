"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type EditableTarget = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
type Layout = "letters" | "symbols";

const UNSUPPORTED_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "radio",
  "range",
  "color",
  "file",
  "image",
  "reset",
  "submit",
  "hidden",
]);

function isEditableTarget(element: HTMLElement | null): element is EditableTarget {
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  if (tag === "textarea") {
    const textarea = element as HTMLTextAreaElement;
    return !textarea.disabled && !textarea.readOnly;
  }
  if (tag === "input") {
    const input = element as HTMLInputElement;
    if (input.disabled || input.readOnly) return false;
    return !UNSUPPORTED_INPUT_TYPES.has((input.type || "").toLowerCase());
  }
  return Boolean(element.isContentEditable);
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value") || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(element, value);
}

function dispatchInputEvent(target: HTMLElement) {
  target.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertText(target: EditableTarget, text: string) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const nextValue = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
    setNativeValue(target, nextValue);
    const caret = start + text.length;
    target.setSelectionRange?.(caret, caret);
    dispatchInputEvent(target);
    return;
  }

  // contenteditable fallback
  target.focus({ preventScroll: true });
  document.execCommand("insertText", false, text);
  dispatchInputEvent(target);
}

function backspace(target: EditableTarget) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    if (start === 0 && end === 0) return;
    const removeFrom = start === end ? Math.max(0, start - 1) : start;
    const nextValue = `${target.value.slice(0, removeFrom)}${target.value.slice(end)}`;
    setNativeValue(target, nextValue);
    target.setSelectionRange?.(removeFrom, removeFrom);
    dispatchInputEvent(target);
    return;
  }

  target.focus({ preventScroll: true });
  document.execCommand("delete");
  dispatchInputEvent(target);
}

function focusNextElement(current: HTMLElement) {
  const focusableSelectors = [
    "input:not([disabled]):not([type='hidden'])",
    "textarea:not([disabled])",
    "select:not([disabled])",
    "button:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(focusableSelectors.join(","))).filter((element) => {
    if (element.closest("[data-osk-root]")) return false;
    if (element === current) return true;
    if (element.tabIndex < 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  if (!candidates.length) return;
  const index = candidates.indexOf(current);
  const next = candidates[(index + 1) % candidates.length];
  if (next && next !== current) {
    next.focus({ preventScroll: true });
  } else if (index === candidates.length - 1) {
    candidates[0]?.focus({ preventScroll: true });
  }
}

export function useOnScreenKeyboardController() {
  const [isOpen, setIsOpen] = useState(false);
  const [layout, setLayout] = useState<Layout>("letters");
  const [shifted, setShifted] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const targetRef = useRef<EditableTarget | null>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    targetRef.current = null;
  }, []);

  const focusTarget = useCallback(() => {
    const target = targetRef.current;
    if (target) {
      target.focus({ preventScroll: true });
    }
  }, []);

  const applyText = useCallback(
    (text: string) => {
      const target = targetRef.current;
      if (!target) return;
      focusTarget();
      insertText(target, text);
      if (shifted && !capsLock) {
        setShifted(false);
      }
    },
    [capsLock, focusTarget, shifted]
  );

  const handleBackspace = useCallback(() => {
    const target = targetRef.current;
    if (!target) return;
    focusTarget();
    backspace(target);
  }, [focusTarget]);

  const handleEnter = useCallback(() => {
    const target = targetRef.current;
    if (!target) return;
    focusTarget();
    focusNextElement(target);
    if (shifted && !capsLock) {
      setShifted(false);
    }
  }, [capsLock, focusTarget, shifted]);

  useEffect(() => {
    function handleFocusIn(event: FocusEvent) {
      const candidate = event.target as HTMLElement | null;
      if (!candidate || candidate.getAttribute("data-disable-osk") === "true") {
        return;
      }
      if (!isEditableTarget(candidate)) {
        return;
      }
      targetRef.current = candidate;
      setIsOpen(true);
    }

    function handleFocusOut() {
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active && isEditableTarget(active)) {
          targetRef.current = active;
          setIsOpen(true);
          return;
        }
        targetRef.current = null;
        setIsOpen(false);
      }, 10);
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousPadding = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "260px";
    return () => {
      document.body.style.paddingBottom = previousPadding;
    };
  }, [isOpen]);

  const toggleShift = useCallback(() => setShifted((value) => !value), []);
  const toggleCaps = useCallback(() => setCapsLock((value) => !value), []);
  const toggleLayout = useCallback(() => setLayout((value) => (value === "letters" ? "symbols" : "letters")), []);

  const transformLetter = useCallback(
    (letter: string) => {
      if (capsLock || shifted) return letter.toUpperCase();
      return letter.toLowerCase();
    },
    [capsLock, shifted]
  );

  return {
    isOpen,
    layout,
    shifted,
    capsLock,
    target: targetRef.current,
    applyText,
    handleBackspace,
    handleEnter,
    close,
    toggleLayout,
    toggleShift,
    toggleCaps,
    transformLetter,
  };
}
