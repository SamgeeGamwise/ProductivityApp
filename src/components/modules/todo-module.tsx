"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePersistentList, ListItem } from "@/hooks/usePersistentList";
import { ModuleCard } from "../module-card";
import clsx from "clsx";
import { format } from "date-fns";

type Filter = "all" | "active" | "done";

export function TodoModule() {
  const { items, add, toggle, remove } = usePersistentList("todo-items");
  const [filter, setFilter] = useState<Filter>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [task, setTask] = useState({ title: "", details: "", dueDate: "", dueTime: "" });

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filter === "active") return !item.done;
      if (filter === "done") return item.done;
      return true;
    });
  }, [items, filter]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dueISO = task.dueDate
      ? buildDueDate(task.dueDate, task.dueTime)
      : undefined;
    const hasTime = Boolean(task.dueTime);
    add(
      task.title,
      task.details || undefined,
      dueISO ? { dueDate: dueISO, hasTime } : undefined
    );
    setTask({ title: "", details: "", dueDate: "", dueTime: "" });
    setIsModalOpen(false);
  };

  return (
    <ModuleCard
      title="Todo List"
      accent="from-emerald-500/30 to-emerald-500/10"
      contentClassName="gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-xs">
          {(["all", "active", "done"] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={clsx(
                "rounded-full border px-3 py-1 font-semibold uppercase tracking-wide transition",
                filter === value ? "border-emerald-300 text-white" : "border-white/20 text-white/70 hover:border-white/50"
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="rounded-full border border-emerald-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-emerald-300"
        >
          Add task
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <ul className="flex-1 space-y-2 overflow-auto pr-1 text-sm">
          {filtered.map((item) => (
            <li key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={clsx(
                      "mt-1 h-5 w-5 rounded-full border transition",
                      item.done ? "border-emerald-300 bg-emerald-300/40" : "border-white/30 hover:border-emerald-200"
                    )}
                    aria-label={`Mark ${item.label} as done`}
                  >
                    {item.done && <span className="block h-full w-full rounded-full bg-emerald-200" />}
                  </button>
                  <div>
                    <p className={clsx("font-semibold", item.done ? "text-slate-400 line-through" : "text-white")}>{item.label}</p>
                    {item.note && <p className="text-xs text-slate-400">{item.note}</p>}
                    {item.meta?.dueDate && (
                      <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-emerald-200">
                        Due {formatDueDate(String(item.meta.dueDate))}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="text-xs text-slate-400 transition hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
          {!filtered.length && <p className="text-center text-xs text-slate-500">No tasks</p>}
        </ul>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/90 p-5 text-sm text-white shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Todo</p>
                <h3 className="text-2xl font-semibold text-white">New task</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/60 hover:text-white"
              >
                Close
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Task</label>
                <input
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-emerald-300"
                  value={task.title}
                  onChange={(event) => setTask((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Details</label>
                <textarea
                  className="h-20 w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-emerald-300"
                  value={task.details}
                  onChange={(event) => setTask((prev) => ({ ...prev, details: event.target.value }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Due date</label>
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-emerald-300"
                    value={task.dueDate}
                    onChange={(event) => setTask((prev) => ({ ...prev, dueDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Time (optional)</label>
                  <input
                    type="time"
                    className="w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-emerald-300"
                    value={task.dueTime}
                    onChange={(event) => setTask((prev) => ({ ...prev, dueTime: event.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                  disabled={!task.title.trim()}
                >
                  Save task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleCard>
  );
}

function buildDueDate(date: string, time: string) {
  if (!date) return undefined;
  if (!time) return `${date}T00:00:00`;
  return `${date}T${time}`;
}

function formatDueDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, value.includes("T") ? "EEE, MMM d • h:mma" : "EEE, MMM d");
}
