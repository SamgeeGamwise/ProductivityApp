"use client";

import Link from "next/link";
import { useUiSettings } from "@/context/ui-settings";
import { useState } from "react";

const SCALE_OPTIONS = [
  { value: 1, label: "Comfort" },
  { value: 1.1, label: "Cozy" },
  { value: 1.2, label: "Roomy" },
  { value: 1.3, label: "Relaxed" },
  { value: 1.45, label: "Large" },
  { value: 1.6, label: "Max" },
];

export default function SettingsPage() {
  const { uiScale, setUiScale } = useUiSettings();
  const [gitStatus, setGitStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [gitMessage, setGitMessage] = useState<string | null>(null);

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

            <div className="mt-6 grid gap-4 md:grid-cols-2">
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

              <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Quick presets</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SCALE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setUiScale(option.value)}
                      className={`rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition ${
                        uiScale === option.value
                          ? "border-sky-400 bg-sky-400/20 text-white"
                          : "border-white/15 text-slate-200 hover:border-white/40"
                      }`}
                    >
                      <span className="block text-base">{option.label}</span>
                      <span className="text-xs text-slate-400">{(option.value * 100).toFixed(0)}%</span>
                    </button>
                  ))}
                </div>
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
        </section>
      </div>
    </main>
  );
}
