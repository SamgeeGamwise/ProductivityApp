"use client";

import Link from "next/link";
import { useUiSettings } from "@/context/ui-settings";
import { useErrorLog } from "@/context/error-log";
import { format } from "date-fns";
import { useState } from "react";

export default function SettingsPage() {
  const { uiScale, setUiScale } = useUiSettings();
  const [gitStatus, setGitStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [gitMessage, setGitMessage] = useState<string | null>(null);
  const { entries, clearEntries } = useErrorLog();
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const handleGitPull = async () => {
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
    <main className="min-h-dvh bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Preferences</p>
            <h1 className="text-3xl font-semibold text-white">Settings</h1>
            <p className="mt-1 text-sm text-slate-400">
              Change interface density to make buttons easier to tap on different devices.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white/60"
          >
            Back to Dashboard
          </Link>
        </div>

        <section className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">Interface scale</h2>
            <p className="mt-1 text-sm text-slate-400">
              Choose how much breathing room buttons and controls should have. This updates instantly across the app.
            </p>

            <div className="mt-6 grid gap-4">
              <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <label htmlFor="ui-scale" className="text-xs uppercase tracking-[0.3em] text-slate-500">
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
                  className="w-full accent-sky-400"
                />
                <p className="text-sm text-slate-300">
                  Current size: <span className="font-semibold text-white">{(uiScale * 100).toFixed(0)}%</span>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">Maintenance</h2>
            <p className="mt-1 text-sm text-slate-400">
              Force the dashboard to pull the latest code via Git if the deployment gets stale.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleGitPull}
                disabled={gitStatus === "running"}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {gitStatus === "running" ? "Pulling…" : "Run git pull"}
              </button>
              {gitMessage && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    gitStatus === "error"
                      ? "border-red-400/40 bg-red-400/10 text-red-200"
                      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-50"
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

          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">Error log</h2>
            <p className="mt-1 text-sm text-slate-400">
              Review client-side errors captured while the dashboard is running. This can help debug refresh issues
              after the app has been open for a long session.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openLogModal}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white/60"
              >
                View error log
              </button>
              <p className="text-xs text-slate-400">
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
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-sm text-white shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Diagnostics</p>
                <h2 className="text-2xl font-semibold text-white">Error log</h2>
                <p className="text-xs text-slate-400">Newest entries appear first.</p>
              </div>
              <button
                type="button"
                onClick={closeLogModal}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/60"
              >
                Close
              </button>
            </div>

            {hasLogEntries ? (
              <ul className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto pr-2">
                {entries.map((entry) => (
                  <li key={entry.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span className="text-[0.7rem] uppercase tracking-[0.3em] text-slate-200">{entry.source}</span>
                      <span>{format(new Date(entry.timestamp), "MMM d, yyyy h:mma")}</span>
                    </div>
                    <p className="mt-2 text-base text-white">{entry.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-8 text-center text-sm text-slate-400">No errors recorded during this session.</p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  clearEntries();
                }}
                disabled={!hasLogEntries}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear log
              </button>
              <button
                type="button"
                onClick={closeLogModal}
                className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/30"
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
