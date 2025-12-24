"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useOnScreenKeyboardController } from "@/hooks/useOnScreenKeyboard";

const LETTER_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const SYMBOL_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""],
  ["#", "+", "=", "_", "\\", "|", "~", "<", ">"],
];

export function OnScreenKeyboard() {
  const [mounted, setMounted] = useState(false);
  const controller = useOnScreenKeyboardController();

  useEffect(() => {
    setMounted(true);
  }, []);

  const targetLabel = useMemo(() => {
    const target = controller.target;
    if (!target) return "No field focused";
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const name = target.getAttribute("aria-label") || target.getAttribute("placeholder");
      return name || target.name || target.type || "Input";
    }
    return "Editing";
  }, [controller.target]);

  if (!mounted || !controller.isOpen) return null;

  const renderKey = (label: string, display?: string, options?: { wide?: boolean; variant?: "primary" | "muted" }) => {
    const text = display || label;
    return (
      <KeyButton
        key={`${label}-${text}`}
        label={text}
        onPress={() => controller.applyText(controller.transformLetter(label))}
        wide={options?.wide}
        variant={options?.variant}
      />
    );
  };

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      data-osk-root
    >
      <div
        className="pointer-events-auto mx-auto max-w-5xl rounded-3xl border border-[#1f2a44] bg-[#050a16]/95 p-3 text-white shadow-[0_-12px_40px_rgba(0,0,0,0.6)] backdrop-blur-lg"
        onMouseDown={(event) => {
          // Keep focus on the active input/textarea
          event.preventDefault();
        }}
        onPointerDown={(event) => event.preventDefault()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8ea2dc]">Keyboard</p>
            <p className="text-sm font-semibold text-white">{targetLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-[#294175] bg-[#0d1933] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#dce5ff] transition hover:border-[#5f82d7] hover:text-white"
              onClick={controller.toggleLayout}
            >
              {controller.layout === "letters" ? "123" : "ABC"}
            </button>
            <button
              type="button"
              className="rounded-full border border-[#294175] bg-[#0d1933] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#dce5ff] transition hover:border-[#5f82d7] hover:text-white"
              onClick={controller.close}
            >
              Hide
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {(controller.layout === "letters" ? LETTER_ROWS : SYMBOL_ROWS).map((row, index) => (
            <div key={index} className="flex items-center justify-center gap-2">
              {controller.layout === "letters"
                ? row.map((key) => renderKey(key, controller.transformLetter(key)))
                : row.map((key) => <KeyButton key={key} label={key} onPress={() => controller.applyText(key)} />)}
            </div>
          ))}

          {controller.layout === "letters" ? (
            <div className="flex items-center justify-center gap-2">
              <KeyToggle
                label="Shift"
                active={controller.shifted}
                onPress={controller.toggleShift}
                icon="⇧"
              />
              <KeyToggle
                label="Caps"
                active={controller.capsLock}
                onPress={controller.toggleCaps}
                icon="⇪"
              />
              <KeyButton label="Space" onPress={() => controller.applyText(" ")} wide />
              <KeyButton label="Enter" onPress={controller.handleEnter} wide variant="primary" />
              <KeyButton label="⌫" onPress={controller.handleBackspace} wide variant="muted" />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <KeyButton label="ABC" onPress={controller.toggleLayout} variant="muted" />
              <KeyButton label="Space" onPress={() => controller.applyText(" ")} wide />
              <KeyButton label="Enter" onPress={controller.handleEnter} wide variant="primary" />
              <KeyButton label="⌫" onPress={controller.handleBackspace} wide variant="muted" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function KeyButton({
  label,
  onPress,
  wide = false,
  variant = "default",
  icon,
}: {
  label: string;
  onPress: () => void;
  wide?: boolean;
  variant?: "default" | "primary" | "muted";
  icon?: string;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "select-none rounded-2xl border px-3 py-3 text-lg font-semibold tracking-wide text-white shadow-inner shadow-[#0f1b37] transition active:translate-y-[1px] active:shadow-none sm:min-w-12",
        wide ? "flex-1" : "min-w-[44px] sm:min-w-[52px]",
        variant === "primary"
          ? "border-[#4f8bff] bg-[#1d2e57] hover:border-[#7fb1ff]"
          : variant === "muted"
            ? "border-[#2a3a5e] bg-[#0e1730] text-[#d4e0ff] hover:border-[#4d6eb8]"
            : "border-[#2a3a5e] bg-[#101a35] hover:border-[#4d6eb8]"
      )}
      onPointerDown={(event) => {
        event.preventDefault();
        onPress();
      }}
    >
      <span className="flex items-center justify-center gap-1">
        {icon && <span className="text-base">{icon}</span>}
        <span>{label}</span>
      </span>
    </button>
  );
}

function KeyToggle({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: string;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "min-w-[72px] select-none rounded-2xl border px-3 py-3 text-sm font-semibold tracking-wide text-white shadow-inner transition active:translate-y-[1px] active:shadow-none",
        active
          ? "border-[#5b8bff] bg-[#1c2c52] shadow-[#1d2f55]"
          : "border-[#2a3a5e] bg-[#0f1931] hover:border-[#4d6eb8]"
      )}
      onPointerDown={(event) => {
        event.preventDefault();
        onPress();
      }}
      aria-pressed={active}
    >
      <span className="flex items-center justify-center gap-2">
        {icon && <span className="text-base">{icon}</span>}
        <span>{label}</span>
      </span>
    </button>
  );
}
