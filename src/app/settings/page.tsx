"use client";

import Link from "next/link";
import { useUiSettings } from "@/context/ui-settings";
import { useErrorLog } from "@/context/error-log";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { format } from "date-fns";
import { useState } from "react";

export default function SettingsPage() {
  const { uiScale, setUiScale } = useUiSettings();
  const [gitStatus, setGitStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [gitMessage, setGitMessage] = useState<string | null>(null);
  const { entries, clearEntries } = useErrorLog();
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const gitPullEnabled = false;

  const handleGitPull = async () => {
    if (!gitPullEnabled) {
      setGitStatus("error");
      setGitMessage("git pull is disabled for static deployments. Publish updates through GitHub Actions instead.");
      return;
    }
    setGitStatus("running");
    setGitMessage(null);
    try {
      const response = await fetch("/api/git/pull", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        setGitStatus("error");
        setGitMessage(payload?.error || payload?.stderr || "git pull failed");
        return;
      }
      const output = payload.stdout || payload.stderr || "git pull completed.";
      setGitStatus("success");
      setGitMessage(output);
    } catch (error) {
      setGitStatus("error");
      setGitMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  const hasLogEntries = entries.length > 0;
  const openLogModal = () => setIsLogModalOpen(true);
  const closeLogModal = () => setIsLogModalOpen(false);

  return (
    <main className="min-h-dvh px-4 py-10 text-slate-100">
      <FullscreenToggle />
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Preferences</p>
            <h1 className="text-3xl font-semibold text-white">Settings</h1>
            <p className="mt-1 text-sm text-slate-300">
              Change interface density to make buttons easier to tap on different devices.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/15 bg-[rgba(11,24,42,0.68)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/35 hover:bg-[rgba(17,34,58,0.8)]"
          >
            Back to Dashboard
          </Link>
        </div>

        <section className="space-y-6">
          <div className="rounded-[1.9rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,8,20,0.24)] backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Interface scale</h2>
            <p className="mt-1 text-sm text-slate-300">
              Choose how much breathing room buttons and controls should have. This updates instantly across the app.
            </p>

            <div className="mt-6 grid gap-4">
              <div className="space-y-3 rounded-[1.4rem] border border-white/8 bg-[rgba(9,18,34,0.72)] p-4">
                <label htmlFor="ui-scale" className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Scale
                </label>
                <input
                  id="ui-scale"
                  type="range"
                  min={0.95}
                  max={1.6}
                  step={0.05}
                  value={uiScale}
                  onChange={(event) => setUiScale(Number(event.target.value))}
                  className="w-full accent-sky-300"
                />
                <p className="text-sm text-slate-300">
                  Current size: <span className="font-semibold text-white">{(uiScale * 100).toFixed(0)}%</span>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,8,20,0.24)] backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Maintenance</h2>
            <p className="mt-1 text-sm text-slate-300">
              Static deployments cannot run server-side git commands. Publish updates through your GitHub Actions deploy pipeline.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleGitPull}
                disabled={!gitPullEnabled || gitStatus === "running"}
                className="rounded-full border border-white/15 bg-[rgba(11,24,42,0.68)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/35 hover:bg-[rgba(17,34,58,0.8)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {gitStatus === "running" ? "Pulling..." : "Run git pull"}
              </button>
              {gitMessage && (
                <div
                  className={`rounded-[1.25rem] border px-4 py-3 text-sm ${
                    gitStatus === "error"
                      ? "border-red-400/35 bg-red-400/10 text-red-200"
                      : "border-emerald-400/25 bg-emerald-400/10 text-emerald-50"
                  }`}
                >
                  <p className="font-semibold">
                    {gitStatus === "error" ? "git pull failed" : "git pull success"}
                  </p>
                  <p className="text-xs text-white/80">{gitMessage}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,8,20,0.24)] backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Error log</h2>
            <p className="mt-1 text-sm text-slate-300">
              Review client-side errors captured while the dashboard is running. This can help debug refresh issues
              after the app has been open for a long session.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openLogModal}
                className="rounded-full border border-white/15 bg-[rgba(11,24,42,0.68)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/35 hover:bg-[rgba(17,34,58,0.8)]"
              >
                View error log
              </button>
              <p className="text-xs text-slate-300">
                {hasLogEntries ? `${entries.length} entr${entries.length === 1 ? "y" : "ies"} recorded` : "No errors recorded yet."}
              </p>
            </div>
          </div>
        </section>
      </div>

      {isLogModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeLogModal();
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-[1.9rem] border border-[var(--surface-border)] bg-[rgba(7,14,26,0.92)] p-6 text-sm text-white shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Diagnostics</p>
                <h2 className="text-2xl font-semibold text-white">Error log</h2>
                <p className="text-xs text-slate-300">Newest entries appear first.</p>
              </div>
              <button
                type="button"
                onClick={closeLogModal}
                className="rounded-full border border-white/15 bg-[rgba(11,24,42,0.68)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/35 hover:bg-[rgba(17,34,58,0.8)]"
              >
                Close
              </button>
            </div>

            {hasLogEntries ? (
              <ul className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto pr-2">
                {entries.map((entry) => (
                  <li key={entry.id} className="rounded-[1.35rem] border border-white/8 bg-[rgba(10,20,37,0.74)] p-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
                      <span className="text-[0.7rem] uppercase tracking-[0.3em] text-slate-100">{entry.source}</span>
                      <span>{format(new Date(entry.timestamp), "MMM d, yyyy h:mma")}</span>
                    </div>
                    <p className="mt-2 text-base text-white">{entry.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-8 text-center text-sm text-slate-300">No errors recorded during this session.</p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  clearEntries();
                }}
                disabled={!hasLogEntries}
                className="rounded-full border border-white/15 bg-[rgba(11,24,42,0.68)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/35 hover:bg-[rgba(17,34,58,0.8)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear log
              </button>
              <button
                type="button"
                onClick={closeLogModal}
                className="rounded-full bg-[rgba(169,193,232,0.18)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[rgba(169,193,232,0.28)]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
