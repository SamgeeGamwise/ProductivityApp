"use client";

import { FormEvent, useState } from "react";
import { usePersistentList } from "@/hooks/usePersistentList";
import { ModuleCard } from "../module-card";
import clsx from "clsx";

const defaultChores = [
  { id: "chore-1", label: "Wipe kitchen counters", note: "Daily", done: false },
  { id: "chore-2", label: "Water plants", note: "Tue / Fri", done: false },
];

const quickChores = [
  { label: "Dishwasher run", note: "Night" },
  { label: "Trash / recycling", note: "Eve" },
  { label: "Vacuum main floor", note: "Weekly" },
  { label: "Pet care", note: "PM" },
];

export function ChoresModule() {
  const { items, add, toggle, remove } = usePersistentList("chore-items", defaultChores);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    add(text, note || undefined);
    setText("");
    setNote("");
  };

  const visible = items.slice(0, 4);
  const remaining = items.length - visible.length;

  return (
    <ModuleCard title="Chores" accent="from-orange-500/30 to-orange-500/10" contentClassName="gap-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {quickChores.map((chore) => (
          <button
            key={chore.label}
            type="button"
            className="rounded-full border border-orange-300/40 px-3 py-1 text-xs font-semibold text-white hover:border-orange-200"
            onClick={() => add(chore.label, chore.note)}
          >
            {chore.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <input
          className="rounded-lg border border-orange-400/40 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-orange-300"
          placeholder="Custom chore"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <input
          className="rounded-lg border border-orange-400/40 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-orange-300"
          placeholder="Cadence"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <button
          type="submit"
          className="rounded-lg bg-orange-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-orange-300"
          disabled={!text.trim()}
        >
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {visible.map((item) => (
          <li key={item.id} className="flex items-start gap-2 rounded-xl border border-white/5 bg-slate-900/80 p-3">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggle(item.id)}
              className="mt-1 h-4 w-4 rounded border border-orange-300/70 bg-slate-950 text-orange-300 focus:ring-orange-300"
            />
            <div className="flex-1">
              <p className={clsx("font-medium", item.done ? "text-slate-400 line-through" : "text-white")}>{item.label}</p>
              {item.note && <p className="text-xs text-slate-400">{item.note}</p>}
            </div>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="text-xs text-slate-400 transition hover:text-red-300"
            >
              Remove
            </button>
          </li>
        ))}
        {!items.length && <p className="text-sm text-slate-400">Tap a chip to add a chore.</p>}
      </ul>
      {remaining > 0 && <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">+{remaining} more</p>}
    </ModuleCard>
  );
}
