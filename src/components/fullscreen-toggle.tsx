"use client";

import { useEffect, useState } from "react";

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = typeof document !== "undefined" && "fullscreenEnabled" in document;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(supported);
    if (!supported) return;

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    handleFullscreenChange();
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (!isSupported) {
    return null;
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await document.documentElement.requestFullscreen();
    } catch {
      // Ignore rejected fullscreen requests so the UI stays usable.
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void toggleFullscreen();
      }}
      className="fixed bottom-4 left-4 z-50 rounded-full border border-white/15 bg-[rgba(11,24,42,0.68)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100 shadow-[0_12px_28px_rgba(4,10,20,0.28)] backdrop-blur-xl transition hover:border-white/35 hover:bg-[rgba(17,34,58,0.8)] hover:text-white"
      aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
    >
      {isFullscreen ? "Exit Full Screen" : "Full Screen"}
    </button>
  );
}
