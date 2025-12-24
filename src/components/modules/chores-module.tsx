"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePersistentList } from "@/hooks/usePersistentList";
import { ModuleCard } from "../module-card";
import clsx from "clsx";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Frequency = "daily" | "weekly" | "monthly" | "custom";

export function ChoresModule() {
  const { items, add, toggle, remove } = usePersistentList("chore-items");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [weeklyDays, setWeeklyDays] = useState<string[]>(["Mon"]);
  const [monthlyDay, setMonthlyDay] = useState("1");
  const [customInterval, setCustomInterval] = useState("14");
  const [customUnit, setCustomUnit] = useState("days");
  const [chore, setChore] = useState({ label: "", details: "" });

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => Number(a.done) - Number(b.done));
  }, [items]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const description = buildFrequencyDescription(frequency, weeklyDays, monthlyDay, customInterval, customUnit);
    const meta = {
      frequency,
      weeklyDays,
      monthlyDay,
      customInterval,
      customUnit,
    };
    add(chore.label, description, meta);
    setChore({ label: "", details: "" });
    setWeeklyDays(["Mon"]);
    setMonthlyDay("1");
    setCustomInterval("14");
    setCustomUnit("days");
    setFrequency("weekly");
    setIsModalOpen(false);
  };

  return (
    <ModuleCard title="Chores" accent="from-orange-500/30 to-orange-500/10" contentClassName="gap-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Recurring tasks</p>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="rounded-full border border-orange-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-orange-300"
        >
          Add chore
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <ul className="flex-1 space-y-2 overflow-auto pr-1 max-h-80">
          {sorted.map((item) => (
            <li key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggle(item.id)}
                    className="mt-1 h-4 w-4 rounded border border-orange-300/70 bg-transparent text-orange-300 focus:ring-orange-300"
                  />
                  <div>
                    <p className={clsx("font-semibold", item.done ? "text-slate-400 line-through" : "text-white")}>{item.label}</p>
                    {item.note && <p className="text-[0.65rem] text-slate-300">{item.note}</p>}
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
          {!sorted.length && <p className="text-center text-xs text-slate-500">No chores</p>}
        </ul>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/90 p-5 text-sm text-white shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-orange-200/80">Chores</p>
                <h3 className="text-2xl font-semibold text-white">New chore</h3>
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
                <label className="text-xs uppercase tracking-wide text-slate-400">Chore</label>
                <input
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-orange-300"
                  value={chore.label}
                  onChange={(event) => setChore((prev) => ({ ...prev, label: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Details</label>
                <textarea
                  className="h-16 w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-orange-300"
                  value={chore.details}
                  onChange={(event) => setChore((prev) => ({ ...prev, details: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Frequency</label>
                <select
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-orange-300"
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as Frequency)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom interval</option>
                </select>
                {frequency === "weekly" && (
                  <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day, weeklyDays, setWeeklyDays)}
                        className={clsx(
                          "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
                          weeklyDays.includes(day)
                            ? "border-orange-300 bg-orange-300/20 text-white"
                            : "border-white/20 text-white/70 hover:border-white/50"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                )}
                {frequency === "monthly" && (
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className="w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-orange-300"
                    value={monthlyDay}
                    onChange={(event) => setMonthlyDay(event.target.value)}
                  />
                )}
                {frequency === "custom" && (
                  <div className="flex gap-3">
                    <input
                      type="number"
                      min={1}
                      className="w-24 rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-orange-300"
                      value={customInterval}
                      onChange={(event) => setCustomInterval(event.target.value)}
                    />
                    <select
                      className="rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-orange-300"
                      value={customUnit}
                      onChange={(event) => setCustomUnit(event.target.value)}
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                )}
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
                  className="w-full rounded-2xl bg-orange-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300 disabled:opacity-60"
                  disabled={!chore.label.trim()}
                >
                  Save chore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleCard>
  );
}

function buildFrequencyDescription(
  frequency: Frequency,
  weeklyDays: string[],
  monthlyDay: string,
  customInterval: string,
  customUnit: string
) {
  switch (frequency) {
    case "daily":
      return "Daily";
    case "weekly":
      return `Weekly · ${weeklyDays.join(", ")}`;
    case "monthly":
      return `Monthly · Day ${monthlyDay}`;
    case "custom":
      return `Every ${customInterval} ${customUnit}`;
    default:
      return "";
  }
}

function toggleDay(day: string, current: string[], setDays: (value: string[]) => void) {
  if (current.includes(day)) {
    setDays(current.filter((d) => d !== day));
  } else {
    setDays([...current, day]);
  }
}
