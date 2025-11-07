"use client";

import { useState } from "react";
import { CalendarModule } from "./modules/calendar-module";
import { TodoModule } from "./modules/todo-module";
import { ChoresModule } from "./modules/chores-module";

export function Dashboard() {
  const [calendarExpanded, setCalendarExpanded] = useState(false);
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
    <div className="h-dvh w-full overflow-hidden bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.25),_transparent_60%)] p-4 text-slate-100">
      <div className="flex h-full w-full flex-col gap-4 overflow-hidden">
        <button
          type="button"
          onClick={handleGitPull}
          disabled={gitStatus === "running"}
          title="Run git pull"
          className="fixed bottom-4 right-4 z-50 rounded-full border border-white/20 bg-slate-900/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/40 backdrop-blur transition hover:border-white/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {gitStatus === "running" ? "Pulling…" : "Refresh Repo"}
        </button>
        {gitMessage && (
          <div className="pointer-events-none fixed bottom-20 right-4 z-40 max-w-xs rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-[11px] shadow-lg shadow-black/40">
            <p className={`font-semibold ${gitStatus === "error" ? "text-red-300" : "text-emerald-300"}`}>
              {gitStatus === "error" ? "git pull failed" : "git pull success"}
            </p>
            <p className="mt-1 text-white/80">{gitMessage}</p>
          </div>
        )}
        <main className="flex-1 min-h-0 overflow-hidden">
          {calendarExpanded ? (
            <div className="flex h-full min-h-0 flex-col">
              <CalendarModule expanded onToggleExpand={() => setCalendarExpanded(false)} />
            </div>
          ) : (
            <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="flex min-h-0">
                <CalendarModule onToggleExpand={() => setCalendarExpanded(true)} />
              </div>
              <div className="grid min-h-0 grid-rows-2 gap-4">
                <div className="flex min-h-0">
                  <TodoModule />
                </div>
                <div className="flex min-h-0">
                  <ChoresModule />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
